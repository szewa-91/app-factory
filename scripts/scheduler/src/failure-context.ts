import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { getAuditLogName, getPreviousFailureLogName, getTaskLogName } from "./agent-runner.js";

function runShell(cwd: string, command: string): string {
  const result = spawnSync("bash", ["-lc", command], {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.error) {
    return result.error.message;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trimEnd();
  return output;
}

function commandExists(cwd: string, command: string): boolean {
  const probe = spawnSync("bash", ["-lc", `command -v ${command} >/dev/null 2>&1`], { cwd, encoding: "utf8" });
  return probe.status === 0;
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function safeTail(cwd: string, filePath: string, lines: number): string {
  if (!existsSync(filePath)) {
    return "";
  }

  return runShell(cwd, `tail -n ${lines} ${JSON.stringify(filePath)}`);
}

export function captureFailureContext(taskId: number, logFile: string, reason: string, workDir: string = process.cwd()): string {
  const previousFailurePath = join(workDir, getPreviousFailureLogName());
  const taskLogName = getTaskLogName(taskId);
  const auditLogName = getAuditLogName(taskId);
  const output: string[] = [];

  output.push("--- FAILURE OBSERVATION ---");
  output.push(`Reason: ${reason}`);
  output.push(`Timestamp: ${nowIso()}`);
  output.push(`Working Dir: ${workDir}`);
  output.push("");

  output.push("--- SYSTEM RESOURCES ---");
  output.push(runShell(workDir, "df -h . | grep -v \"Filesystem\""));

  if (commandExists(workDir, "free")) {
    output.push(runShell(workDir, "free -m | awk '/^Mem:/'"));
  } else if (existsSync("/proc/meminfo")) {
    output.push(
      runShell(
        workDir,
        "awk '/^MemTotal:/ { total=$2 / 1024.0 } /^MemAvailable:/ { available=$2 / 1024.0 } END { if (total > 0) { used = total - available; printf \"Mem: %d %d %d\\n\", total, used, available } else { print \"Mem: unavailable\" } }' /proc/meminfo"
      )
    );
  } else {
    output.push("Mem: unavailable (free and /proc/meminfo missing)");
  }
  output.push("");

  output.push("--- DIRECTORY LISTING (Tree View) ---");
  if (commandExists(workDir, "tree")) {
    output.push(runShell(workDir, "tree -L 3 -I '.git|node_modules|.next'"));
  } else {
    output.push(runShell(workDir, "ls -laR --ignore=.git --ignore=node_modules --ignore=.next | head -n 100"));
  }
  output.push("");

  const insideGit = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: workDir, stdio: "ignore" }).status === 0;
  if (insideGit) {
    output.push("--- GIT STATUS ---");
    output.push(runShell(workDir, "git status"));
    output.push("");
    output.push("--- GIT DIFF (Staged Changes) ---");
    output.push(runShell(workDir, "git diff --cached | head -n 50"));
    output.push("");
    output.push("--- GIT DIFF (Uncommitted Changes) ---");
    output.push(runShell(workDir, "git diff | head -n 100"));
    output.push("");
    output.push("--- RECENT GIT LOG ---");
    output.push(runShell(workDir, "git log -n 5 --oneline"));
    output.push("");
  }

  output.push("--- DOCKER STATUS (Running Containers) ---");
  if (commandExists(workDir, "docker")) {
    output.push(runShell(workDir, "docker ps --format \"table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}\" | head -n 20"));
  } else {
    output.push("docker: command not found");
  }
  output.push("");

  output.push("--- DOCKER STATS (Resource Usage) ---");
  if (commandExists(workDir, "docker")) {
    output.push(runShell(workDir, "docker stats --no-stream --format \"table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.NetIO}}\""));
  } else {
    output.push("docker: command not found");
  }
  output.push("");

  if (existsSync(join(workDir, "docker-compose.yml"))) {
    output.push("--- DOCKER COMPOSE LOGS ---");
    if (commandExists(workDir, "docker") && spawnSync("bash", ["-lc", "docker compose version >/dev/null 2>&1"], { cwd: workDir }).status === 0) {
      output.push(runShell(workDir, "docker compose logs --tail 50 2>&1 | head -n 100"));
    } else {
      output.push("docker compose plugin unavailable");
    }
    output.push("");
  }

  output.push("--- LAST LOG LINES ---");
  let hasLogs = false;

  const fullTaskLogPath = join(workDir, taskLogName);
  if (existsSync(fullTaskLogPath)) {
    hasLogs = true;
    output.push(`--- File: ${taskLogName} ---`);
    output.push(safeTail(workDir, fullTaskLogPath, 150));
    output.push("");
  }

  const fullAuditLogPath = join(workDir, auditLogName);
  if (existsSync(fullAuditLogPath)) {
    hasLogs = true;
    output.push(`--- File: ${auditLogName} ---`);
    output.push(safeTail(workDir, fullAuditLogPath, 150));
    output.push("");
  }

  const resolvedLog = existsSync(logFile) ? logFile : join(workDir, logFile);
  const resolvedLogName = resolvedLog.startsWith(workDir) ? resolvedLog.slice(workDir.length + 1) : resolvedLog;
  if (!hasLogs && existsSync(resolvedLog)) {
    hasLogs = true;
    output.push(`--- File: ${resolvedLogName} ---`);
    output.push(safeTail(workDir, resolvedLog, 150));
    output.push("");
  }

  if (!hasLogs) {
    output.push("No task or audit logs found.");
  }

  output.push("--- END FAILURE OBSERVATION ---");

  mkdirSync(dirname(previousFailurePath), { recursive: true });
  writeFileSync(previousFailurePath, output.join("\n"), "utf8");
  return previousFailurePath;
}
