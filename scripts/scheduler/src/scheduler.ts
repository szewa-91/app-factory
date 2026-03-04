import { appendFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { checkResources } from "./resources.js";
import { dependenciesDone } from "./dependencies.js";
import { getPreviousFailureLogName, getTaskLogName, runAgent, AgentRole } from "./agent-runner.js";
import { runAuditPipeline } from "./audit.js";
import { BusyTask, getSchedulerDatabase, SchedulerDatabase, TaskCandidate } from "./db.js";
import { captureFailureContext } from "./failure-context.js";
import { recordPreTaskSha, resetToSha } from "./git-safety.js";
import { readSharedKnowledge } from "./shared-knowledge.js";
import { TaskStatus } from "./types.js";
import { triageTask } from "./triage.js";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR ?? "/home/szewa/app-factory";
const LOG_FILE = process.env.FACTORY_LOG_FILE ?? `${WORKSPACE_DIR}/factory.log`;
const MAX_RETRIES = 3;
const SAFE_PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function log(message: string): void {
  const line = `[${nowIso()}] ${message}`;
  process.stdout.write(`${line}\n`);
  appendFileSync(LOG_FILE, `${line}\n`);
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid(pidFile: string): number | null {
  if (!existsSync(pidFile)) {
    return null;
  }

  const value = readFileSync(pidFile, "utf8").trim();
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const pid = Number.parseInt(value, 10);
  return Number.isSafeInteger(pid) ? pid : null;
}

function getPidFilePath(task: BusyTask): string | null {
  if (task.project_name === "app-factory") {
    return `${WORKSPACE_DIR}/agent.pid`;
  }

  if (!task.project_name || !SAFE_PROJECT_NAME_PATTERN.test(task.project_name)) {
    return null;
  }

  return `${WORKSPACE_DIR}/apps/${task.project_name}/agent.pid`;
}

function isNonNegativeInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function normalizeRetryCount(taskId: number, retryCount: number): number {
  if (isNonNegativeInt(retryCount)) {
    return retryCount;
  }

  log(`[WARN] RISK-CHECK: Invalid retry_count '${retryCount}' for task ${taskId}; defaulting to 0.`);
  return 0;
}

function normalizePriority(taskId: number, priority: number): number {
  if (isNonNegativeInt(priority)) {
    return priority;
  }

  log(`[WARN] RISK-CHECK: Invalid priority '${priority}' for task ${taskId}; defaulting to 0.`);
  return 0;
}

export interface SchedulerCycleResult {
  status:
    | "already_busy"
    | "resource_overload"
    | "no_candidates"
    | "dependencies_blocked"
    | "race_lost"
    | "done"
    | "ready_for_retry"
    | "failed";
  taskId: number | null;
  cpu: number;
  ram: number;
  reason: string;
}

function recoverStaleTasks(database: SchedulerDatabase): boolean {
  const busyTasks = database.getBusyTasks();
  if (busyTasks.length === 0) {
    return false;
  }

  for (const task of busyTasks) {
    const taskStatus = database.getTaskStatus(task.id);
    if (taskStatus === TaskStatus.AUDITING) {
      log(`INFO: Task ${task.id} is in AUDITING phase. Factory is busy. Waiting.`);
      return true;
    }

    const pidFile = getPidFilePath(task);
    if (pidFile === null) {
      database.updateTaskStatusPlain(task.id, TaskStatus.READY);
      continue;
    }

    if (existsSync(pidFile)) {
      const pid = readPid(pidFile);
      if (pid !== null && isPidRunning(pid)) {
        log(`INFO: Task ${task.id} is already IN_PROGRESS (PID: ${pid}). Waiting.`);
        return true;
      }

      log(`[WARN] Task ${task.id} marked IN_PROGRESS but PID ${pid ?? "unknown"} is dead. Resetting...`);
      database.updateTaskStatusPlain(task.id, TaskStatus.READY);
      rmSync(pidFile, { force: true });
      continue;
    }

    log(`[WARN] Task ${task.id} marked IN_PROGRESS but no PID file found. Resetting...`);
    database.updateTaskStatusPlain(task.id, TaskStatus.READY);
  }

  return false;
}

function promoteTasks(database: SchedulerDatabase): void {
  // Promote CREATED tasks to TRIAGE
  const createdTasks = database.getCreatedTasks();
  for (const task of createdTasks) {
    if (!task.depends_on) {
      database.updateTaskStatusPlain(task.id, TaskStatus.TRIAGE);
      continue;
    }

    if (dependenciesDone(task.depends_on, database)) {
      log(`[INFO] Promoting Task ${task.id} to TRIAGE (dependencies met).`);
      database.updateTaskStatusPlain(task.id, TaskStatus.TRIAGE);
    }
  }

  // Triage TRIAGE tasks and move to READY or PENDING_APPROVAL
  const triageTasks = database.getTriageTasks();
  for (const task of triageTasks) {
    const result = triageTask({
      title: task.title,
      description: task.description,
      priority: task.priority
    });

    const targetStatus = result.difficulty === "high" ? TaskStatus.PENDING_APPROVAL : TaskStatus.READY;
    database.assignTriageTask(task.id, result.agentRole, targetStatus, nowIso());
    log(`[INFO] Task ${task.id} triaged: difficulty=${result.difficulty}, role=${result.agentRole}, status=${targetStatus}`);
  }
}

interface SelectionResult {
  candidate: TaskCandidate | null;
  hadCandidates: boolean;
}

function selectCandidate(database: SchedulerDatabase): SelectionResult {
  const candidates = database.getReadyOrApprovedCandidates();
  if (candidates.length === 0) {
    return { candidate: null, hadCandidates: false };
  }

  for (const task of candidates) {
    if (!dependenciesDone(task.depends_on, database)) {
      continue;
    }

    const retryCount = normalizeRetryCount(task.id, task.retry_count);
    const priority = normalizePriority(task.id, task.priority);
    const requiresApproval = task.project_name === "app-factory" || priority >= 10;

    if (task.status === TaskStatus.READY && retryCount === 0 && requiresApproval) {
      log(`[INFO] RISK-CHECK: Task [${task.id}] is high-risk. Moving to PENDING_APPROVAL.`);
      database.moveTaskToPendingApproval(task.id, nowIso());
      continue;
    }

    return {
      candidate: {
        ...task,
        retry_count: retryCount,
        priority
      },
      hadCandidates: true
    };
  }

  return { candidate: null, hadCandidates: true };
}

function getProjectPath(projectName: string | null): string {
  if (projectName === "app-factory") {
    return WORKSPACE_DIR;
  }

  return join(WORKSPACE_DIR, "apps", projectName ?? "");
}

async function buildDeveloperPrompt(task: TaskCandidate, projectPath: string): Promise<string> {
  const lessons = await readSharedKnowledge(WORKSPACE_DIR);
  const lessonPath = `${WORKSPACE_DIR}/lessons/${task.id}_${Math.floor(Date.now() / 1000)}.md`;

  let prompt = `TASK: ${task.title}. DESCRIPTION: ${task.description}. Refer to PRD.md for full context.${lessons} IMPORTANT: Once finished, write a concise summary (1-3 sentences) to 'TASK_SUMMARY.md', write a 'lesson learned' to '${lessonPath}' (focus on technical insights), and exit.`;

  const previousFailurePath = join(projectPath, getPreviousFailureLogName());
  if (task.retry_count > 0 && existsSync(previousFailurePath)) {
    const context = readFileSync(previousFailurePath, "utf8").slice(0, 12000);
    prompt += `\n\n--- SELF-HEALING ANALYSIS (Retry #${task.retry_count}) ---\nThe previous attempt failed. Below is the comprehensive diagnostic context (logs, directory state, Docker status, Git diff).\nPlease analyze this data to identify the root cause (e.g., misconfiguration, missing dependencies, crash) and implement a robust fix.\n\n${context}\n--- END DIAGNOSTIC CONTEXT ---`;
    log("[INFO] Self-Healing active: Providing failure context from previous attempt.");
  }

  return prompt;
}

function applyRetryOrFailure(
  database: SchedulerDatabase,
  task: TaskCandidate,
  retryCount: number,
  reason: string,
  maxReason: string
): SchedulerCycleResult {
  if (retryCount < MAX_RETRIES) {
    database.markTaskReadyForRetry(task.id, reason, nowIso());
    return {
      status: "ready_for_retry",
      taskId: task.id,
      cpu: 0,
      ram: 0,
      reason
    };
  }

  log(`[FAILURE] Max retries (${MAX_RETRIES}) reached for Task ${task.id}.`);
  database.markTaskFailed(task.id, maxReason, nowIso());
  return {
    status: "failed",
    taskId: task.id,
    cpu: 0,
    ram: 0,
    reason: maxReason
  };
}

function handleDeveloperFailure(
  database: SchedulerDatabase,
  task: TaskCandidate,
  retryCount: number,
  reason: string,
  maxReason: string,
  projectPath: string,
  taskLogPath: string,
  preTaskSha: string
): SchedulerCycleResult {
  captureFailureContext(task.id, taskLogPath, reason, projectPath);

  if (task.project_name === "app-factory" && preTaskSha) {
    log(`[GIT] Task failed. Resetting to ${preTaskSha}...`);
    resetToSha(preTaskSha, projectPath);
  }

  return applyRetryOrFailure(database, task, retryCount, reason, maxReason);
}

export async function runSchedulerCycle(
  database: SchedulerDatabase = getSchedulerDatabase()
): Promise<SchedulerCycleResult> {
  if (recoverStaleTasks(database)) {
    return { status: "already_busy", taskId: null, cpu: 0, ram: 0, reason: "busy" };
  }

  promoteTasks(database);

  const resources = await checkResources();
  log(`[RESOURCES] CPU: ${resources.cpu}% | RAM: ${resources.ram}%`);
  if (resources.skip) {
    log("[RESOURCE-OVERLOAD] Resource usage exceeds threshold (80%). Skipping task execution.");
    return {
      status: "resource_overload",
      taskId: null,
      cpu: resources.cpu,
      ram: resources.ram,
      reason: "resource_overload"
    };
  }

  const selection = selectCandidate(database);
  if (!selection.hadCandidates) {
    log("INFO: No READY or APPROVED tasks found.");
    return {
      status: "no_candidates",
      taskId: null,
      cpu: resources.cpu,
      ram: resources.ram,
      reason: "no_candidates"
    };
  }

  if (selection.candidate === null) {
    log("INFO: READY tasks exist but dependencies are not met.");
    return {
      status: "dependencies_blocked",
      taskId: null,
      cpu: resources.cpu,
      ram: resources.ram,
      reason: "dependencies_blocked"
    };
  }

  const task = selection.candidate;
  log(`[SELECTED] Task [${task.id}] ${task.title} for project ${task.project_name ?? ""}`);

  const claimChanged = database.claimTask(task.id, nowIso());
  if (claimChanged === 0) {
    log(`[RACE] Task ${task.id} was claimed by another instance. Exiting.`);
    return {
      status: "race_lost",
      taskId: task.id,
      cpu: resources.cpu,
      ram: resources.ram,
      reason: "race_lost"
    };
  }

  const projectPath = getProjectPath(task.project_name);
  const domain = task.project_name ? database.getProjectDomain(task.project_name) : null;

  const preTaskSha = recordPreTaskSha(projectPath);
  if (preTaskSha) {
    log(`[SAFETY] Recorded pre-task state ${preTaskSha}`);
  }

  const prompt = await buildDeveloperPrompt(task, projectPath);
  const taskLogPath = join(projectPath, getTaskLogName(task.id));

  log(`[AGENT_START] Task [${task.id}] in ${projectPath} (Log: ${getTaskLogName(task.id)})`);
  process.env.APP_FACTORY_HEADLESS = "true";
  const agentRole = (task.assigned_agent ?? "developer") as AgentRole;
  const exitCode = await runAgent(projectPath, prompt, taskLogPath, true, agentRole);

  if (exitCode === 127) {
    log("[ERROR] Agent binary not found (all providers in chain returned 127).");
    database.markTaskFailedWithoutNotes(task.id, nowIso());
    throw new Error("agent binary not found");
  }

  if (exitCode === 0) {
    const auditResult = await runAuditPipeline({
      database,
      task,
      projectPath,
      taskLogPath,
      retryCount: task.retry_count,
      domain,
      preTaskSha,
      log,
      workspaceDir: WORKSPACE_DIR
    });

    return {
      status: auditResult.status === "done" ? "done" : auditResult.status,
      taskId: task.id,
      cpu: resources.cpu,
      ram: resources.ram,
      reason: auditResult.reason
    };
  }

  if (exitCode === 124) {
    log(`[TIMEOUT] Task ${task.id} (30m exceeded).`);
    return handleDeveloperFailure(
      database,
      task,
      task.retry_count,
      "Timeout after 30 minutes",
      "Timeout (Max retries reached)",
      projectPath,
      taskLogPath,
      preTaskSha
    );
  }

  log(`[FAILURE] Task ${task.id} (Exit: ${exitCode}). Check ${projectPath}/${getTaskLogName(task.id)}`);
  return handleDeveloperFailure(
    database,
    task,
    task.retry_count,
    `Agent exit code ${exitCode}`,
    `Exit code ${exitCode} (Max retries reached)`,
    projectPath,
    taskLogPath,
    preTaskSha
  );
}
