import { access, appendFile, readFile, rm } from "node:fs/promises";
import { constants as fsConstants, createWriteStream, existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { SchedulerDatabase, TaskCandidate } from "./db.js";
import { getAuditLogName, getPreviousFailureLogName, getTaskLogName, runAgent } from "./agent-runner.js";
import { captureFailureContext } from "./failure-context.js";
import { commitAllChanges, gitHasDirtyState, resetToSha } from "./git-safety.js";

const DEFAULT_WORKSPACE_DIR = process.env.WORKSPACE_DIR ?? "/home/szewa/app-factory";
const MAX_RETRIES = 3;

export interface AuditPipelineParams {
  database: SchedulerDatabase;
  task: TaskCandidate;
  projectPath: string;
  taskLogPath: string;
  retryCount: number;
  domain: string | null;
  preTaskSha: string;
  log: (message: string) => void;
  workspaceDir?: string;
}

export interface AuditPipelineResult {
  status: "done" | "ready_for_retry" | "failed";
  reason: string;
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function sanitizeNotes(raw: string): string {
  return raw.replace(/'/g, " ").slice(0, 500);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function runCommandToTaskLog(command: string, args: string[], cwd: string, taskLogPath: string): Promise<number> {
  return await new Promise<number>((resolve) => {
    const logStream = createWriteStream(taskLogPath, { flags: "a" });
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout?.pipe(logStream, { end: false });
    child.stderr?.pipe(logStream, { end: false });

    child.on("error", () => {
      logStream.end();
      resolve(1);
    });

    child.on("close", (code) => {
      logStream.end();
      resolve(code ?? 1);
    });
  });
}

async function transitionFailure(
  database: SchedulerDatabase,
  task: TaskCandidate,
  reasonForContext: string,
  reasonForDb: string,
  retryCount: number,
  projectPath: string,
  logFilePath: string,
  preTaskSha: string,
  log: (message: string) => void
): Promise<AuditPipelineResult> {
  captureFailureContext(task.id, logFilePath, reasonForContext, projectPath);

  if (task.project_name === "app-factory" && preTaskSha) {
    log(`[GIT] Resetting to ${preTaskSha}...`);
    resetToSha(preTaskSha, projectPath);
  }

  if (retryCount < MAX_RETRIES) {
    database.markTaskReadyForRetry(task.id, reasonForDb, nowIso());
    return {
      status: "ready_for_retry",
      reason: reasonForDb
    };
  }

  const finalReason = `${reasonForDb} (Max retries reached)`;
  log(`[FAILURE] Max retries (${MAX_RETRIES}) reached for Task ${task.id}.`);
  database.markTaskFailed(task.id, finalReason, nowIso());
  return {
    status: "failed",
    reason: finalReason
  };
}

function buildAuditPrompt(
  task: TaskCandidate,
  retryCount: number,
  previousAuditNotes: string,
  workspaceDir: string,
  taskLogName: string
): string {
  if (retryCount === 0) {
    return `ROLE: AUDITOR. TASK: ${task.title}. The Developer agent has just completed this task. Review the changes in the codebase and the logs in ${taskLogName}. YOUR MISSION: (1) Check the 'Anti-Placeholder Policy' - no stub code or TODO placeholders in production paths. (2) Check for security vulnerabilities (injection, secrets in code, broken auth, etc.). (3) Flag technical debt, missing error handling, or architectural concerns. PASS/FAIL RULES: Write 'AUDIT_PASSED' to AUDIT_RESULT.md if the work is solid. You may FAIL for non-critical issues on this first pass to give the developer a chance to fix them. Document all findings clearly in AUDIT_RESULT.md.`;
  }

  const retryContext = previousAuditNotes
    ? ` PREVIOUS AUDIT FEEDBACK (already given to the developer): ${previousAuditNotes}.`
    : "";

  return `ROLE: AUDITOR. TASK: ${task.title}. This is audit attempt ${retryCount + 1} (retry_count=${retryCount}). The developer was already given feedback and has made corrections.${retryContext} Review the changes in ${taskLogName}. YOUR MISSION: Verify previous issues were addressed. PASS/FAIL RULES: Write 'AUDIT_PASSED' to AUDIT_RESULT.md unless there is a CRITICAL issue: active security vulnerability (injection, secrets, broken auth) or a blatant anti-placeholder violation. Do NOT fail for style, minor hardening, missing smoke tests, or any issue not previously flagged. Write non-critical observations to ${workspaceDir}/lessons/${task.id}_$(date +%s).md only.`;
}

interface VerifyResult {
  passed: boolean;
  verifyOk: boolean;
  httpOk: boolean;
}

async function runVerify(
  projectPath: string,
  domain: string | null,
  taskLogPath: string,
  log: (message: string) => void
): Promise<VerifyResult> {
  const verifyPath = join(projectPath, "verify.sh");

  let verifyOk = true;
  let usedVerifyScript = false;

  if (await isExecutable(verifyPath)) {
    log("[CHECK] Running internal verify.sh...");
    const verifyExit = await runCommandToTaskLog("./verify.sh", [], projectPath, taskLogPath);
    if (verifyExit !== 0) {
      log("[CHECK] Internal verify.sh FAILED.");
      verifyOk = false;
    } else {
      log("[CHECK] Internal verify.sh PASSED.");
    }
    usedVerifyScript = true;
  }

  let httpOk = true;
  if (!usedVerifyScript && domain) {
    log(`[CHECK] Probing https://${domain}...`);
    const probeExit = await runCommandToTaskLog("curl", ["-f", "-s", `https://${domain}`], projectPath, taskLogPath);
    if (probeExit !== 0) {
      log("[CHECK] HTTP probe FAILED.");
      httpOk = false;
    } else {
      log("[CHECK] HTTP probe PASSED.");
    }
  } else if (usedVerifyScript) {
    log("[CHECK] Skipping scheduler HTTP probe because verify.sh is authoritative.");
  }

  return {
    passed: verifyOk && httpOk,
    verifyOk,
    httpOk
  };
}

async function cleanTemporaryFiles(projectPath: string): Promise<void> {
  const toDelete = [getPreviousFailureLogName(), "PREVIOUS_FAILURE.log", "TASK_SUMMARY.md", "AUDIT_RESULT.md"];

  await Promise.all(
    toDelete.map(async (fileName) => {
      await rm(join(projectPath, fileName), { force: true });
    })
  );
}

async function updateLaunchNotes(task: TaskCandidate, projectPath: string, taskLogPath: string): Promise<void> {
  const launchPrompt = `Summarize the new features implemented in Task ${task.id} (${task.title}) for the end-user. Append this to LAUNCH.md in a clean, user-friendly format. Focus on 'What\'s New'.`;
  const launchLogPath = `${taskLogPath}.launch`;

  await runAgent(projectPath, launchPrompt, launchLogPath, false, "launchNotes");

  const launchLogContent = await readText(launchLogPath);
  if (launchLogContent) {
    await appendFile(taskLogPath, launchLogContent, "utf8");
  }

  await rm(launchLogPath, { force: true });
}

async function readAuditOutcome(projectPath: string): Promise<{ passed: boolean; notes: string }> {
  const auditResultPath = join(projectPath, "AUDIT_RESULT.md");

  if (!(await fileExists(auditResultPath))) {
    return {
      passed: false,
      notes: "AUDIT_FAILED"
    };
  }

  const auditResult = await readText(auditResultPath);
  if (auditResult.includes("AUDIT_PASSED")) {
    const notes = sanitizeNotes(auditResult.replace(/AUDIT_PASSED/g, "").trim());
    return {
      passed: true,
      notes
    };
  }

  return {
    passed: false,
    notes: sanitizeNotes(auditResult)
  };
}

async function maybeCommitAppFactoryTask(task: TaskCandidate, projectPath: string, log: (message: string) => void): Promise<void> {
  if (task.project_name !== "app-factory") {
    return;
  }

  if (!gitHasDirtyState(projectPath)) {
    log(`[GIT] No changes to commit for Task ${task.id}.`);
    return;
  }

  log(`[GIT] Committing changes for Task ${task.id}...`);
  commitAllChanges(`Task [${task.id}]: ${task.title} (Audited)`, projectPath);
}

export async function runAuditPipeline(params: AuditPipelineParams): Promise<AuditPipelineResult> {
  const workspaceDir = params.workspaceDir ?? DEFAULT_WORKSPACE_DIR;

  params.log(`[AUDIT] Starting Phase B (Auditor) for Task ${params.task.id}...`);
  params.database.markTaskAuditing(params.task.id, nowIso());

  const previousAuditNotes = params.database.getTaskAuditNotes(params.task.id).slice(0, 800);
  const taskLogName = getTaskLogName(params.task.id);
  const auditPrompt = buildAuditPrompt(params.task, params.retryCount, previousAuditNotes, workspaceDir, taskLogName);

  const auditLogPath = join(params.projectPath, getAuditLogName(params.task.id));
  await runAgent(params.projectPath, auditPrompt, auditLogPath, false, "auditor");

  const auditOutcome = await readAuditOutcome(params.projectPath);

  if (!auditOutcome.passed) {
    params.log(`[AUDIT] Task ${params.task.id} FAILED review. Notes: ${auditOutcome.notes}`);
    return await transitionFailure(
      params.database,
      params.task,
      `Audit failed: ${auditOutcome.notes}`,
      auditOutcome.notes,
      params.retryCount,
      params.projectPath,
      auditLogPath,
      params.preTaskSha,
      params.log
    );
  }

  params.log(`[AUDIT] Task ${params.task.id} PASSED review.`);
  params.log(`[CHECK] Verifying Task ${params.task.id}...`);

  await delay(5000);

  const verifyResult = await runVerify(params.projectPath, params.domain, params.taskLogPath, params.log);
  if (!verifyResult.passed) {
    const reason = `Verification failed (Verify: ${verifyResult.verifyOk}, HTTP: ${verifyResult.httpOk})`;
    params.log(`[FAILURE] ${reason}.`);
    return await transitionFailure(
      params.database,
      params.task,
      reason,
      reason,
      params.retryCount,
      params.projectPath,
      params.taskLogPath,
      params.preTaskSha,
      params.log
    );
  }

  const summaryPath = join(params.projectPath, "TASK_SUMMARY.md");
  const summary = existsSync(summaryPath) ? await readText(summaryPath) : "Developer completed changes.";
  params.log(`[DONE] Task ${params.task.id} fully verified. Summary: ${summary || "Developer completed changes."}`);

  params.database.markTaskDone(params.task.id, auditOutcome.notes, nowIso());

  params.log("[LAUNCH] Updating LAUNCH.md...");
  await updateLaunchNotes(params.task, params.projectPath, params.taskLogPath);

  await maybeCommitAppFactoryTask(params.task, params.projectPath, params.log);
  await cleanTemporaryFiles(params.projectPath);

  return {
    status: "done",
    reason: "verified"
  };
}
