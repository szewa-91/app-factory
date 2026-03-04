import { appendFileSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, closeSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, isAbsolute, join } from "node:path";

const GEMINI_BIN = process.env.GEMINI_BIN ?? "/home/szewa/.npm-global/bin/gemini";
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "/home/szewa/.local/bin/claude";
const CODEX_BIN = process.env.CODEX_BIN ?? "/home/szewa/.npm-global/bin/codex";
const AGENT_TIMEOUT_MS = 30 * 60 * 1000;
const AGENT_LOG_DIR = "logs/agents";

const GEMINI_CAPACITY = ["You have exhausted your capacity on this model"];
const CLAUDE_CAPACITY = ["rate_limit_error", "Rate limit reached", "rate limit exceeded", "overloaded_error", "You've hit your limit", "you've hit your limit"];
const CODEX_CAPACITY  = ["rate limit", "Rate limit", "429", "quota exceeded"];

export type AgentRole = "developer" | "auditor" | "launchNotes" | "ui-developer" | "architect";

interface AgentEntry {
  binary: string;
  model: string;
  buildArgs: (prompt: string, workDir: string) => string[];
  capacityMessages: string[];
}

interface RunCommandOptions {
  binary: string;
  args: string[];
  workDir: string;
  logPath: string;
  append: boolean;
  background: boolean;
}

function resolveLogPath(workDir: string, logFile: string): string {
  if (isAbsolute(logFile)) {
    return logFile;
  }

  return join(workDir, logFile);
}

function readLog(logPath: string): string {
  if (!existsSync(logPath)) {
    return "";
  }

  try {
    return readFileSync(logPath, "utf8");
  } catch {
    return "";
  }
}

function buildChain(role: AgentRole): AgentEntry[] {
  switch (role) {
    case "developer": return [
      { binary: CLAUDE_BIN, model: "claude-sonnet-4-6",     buildArgs: (p) => ["-p", "--model", "claude-sonnet-4-6", "--effort", "high", "--dangerously-skip-permissions", p], capacityMessages: CLAUDE_CAPACITY },
      { binary: CODEX_BIN,  model: "gpt-5.2-codex",         buildArgs: (p, d) => ["exec", "-m", "gpt-5.2-codex", "-c", "model_reasoning_effort=high", "--dangerously-bypass-approvals-and-sandbox", "-C", d, p], capacityMessages: CODEX_CAPACITY },
      { binary: GEMINI_BIN, model: "gemini-3.1-pro-preview", buildArgs: (p) => ["--yolo", "-m", "gemini-3.1-pro-preview", p], capacityMessages: [] },
    ];
    case "auditor": return [
      { binary: CODEX_BIN,  model: "gpt-5.3-codex",         buildArgs: (p, d) => ["exec", "-m", "gpt-5.3-codex", "-c", "model_reasoning_effort=high", "--dangerously-bypass-approvals-and-sandbox", "-C", d, p], capacityMessages: CODEX_CAPACITY },
      { binary: CLAUDE_BIN, model: "claude-sonnet-4-6",     buildArgs: (p) => ["-p", "--model", "claude-sonnet-4-6", "--effort", "high", "--dangerously-skip-permissions", p], capacityMessages: CLAUDE_CAPACITY },
      { binary: GEMINI_BIN, model: "gemini-3.1-pro-preview", buildArgs: (p) => ["--yolo", "-m", "gemini-3.1-pro-preview", p], capacityMessages: [] },
    ];
    case "launchNotes": return [
      { binary: GEMINI_BIN, model: "gemini-3-flash",     buildArgs: (p) => ["--yolo", "-m", "gemini-3-flash", p], capacityMessages: GEMINI_CAPACITY },
      { binary: CLAUDE_BIN, model: "claude-haiku-4-5",   buildArgs: (p) => ["-p", "--model", "claude-haiku-4-5", "--dangerously-skip-permissions", p], capacityMessages: CLAUDE_CAPACITY },
      { binary: CODEX_BIN,  model: "gpt-5.1-codex-mini", buildArgs: (p, d) => ["exec", "-m", "gpt-5.1-codex-mini", "--dangerously-bypass-approvals-and-sandbox", "-C", d, p], capacityMessages: [] },
    ];
    case "ui-developer": return [
      { binary: CLAUDE_BIN, model: "claude-sonnet-4-6", buildArgs: (p) => ["-p", "--model", "claude-sonnet-4-6", "--effort", "low", "--dangerously-skip-permissions", p], capacityMessages: CLAUDE_CAPACITY },
      { binary: GEMINI_BIN, model: "gemini-3-flash", buildArgs: (p) => ["--yolo", "-m", "gemini-3-flash", p], capacityMessages: GEMINI_CAPACITY },
    ];
    case "architect": return [
      { binary: CODEX_BIN, model: "gpt-5.3-codex", buildArgs: (p, d) => ["exec", "-m", "gpt-5.3-codex", "-c", "model_reasoning_effort=high", "--dangerously-bypass-approvals-and-sandbox", "-C", d, p], capacityMessages: CODEX_CAPACITY },
      { binary: CLAUDE_BIN, model: "claude-sonnet-4-6", buildArgs: (p) => ["-p", "--model", "claude-sonnet-4-6", "--effort", "high", "--dangerously-skip-permissions", p], capacityMessages: CLAUDE_CAPACITY },
      { binary: GEMINI_BIN, model: "gemini-3.1-pro-preview", buildArgs: (p) => ["--yolo", "-m", "gemini-3.1-pro-preview", p], capacityMessages: [] },
    ];
  }
}

async function runCommand(options: RunCommandOptions): Promise<number> {
  const pidFile = join(options.workDir, "agent.pid");

  return await new Promise<number>((resolve) => {
    let timedOut = false;
    let settled = false;

    const outputStream = createWriteStream(options.logPath, { flags: options.append ? "a" : "w" });

    const child = spawn(options.binary, options.args, {
      cwd: options.workDir,
      env: {
        ...process.env,
        APP_FACTORY_HEADLESS: "true"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const cleanup = (code: number): void => {
      if (settled) {
        return;
      }

      settled = true;
      outputStream.end();
      if (options.background) {
        rmSync(pidFile, { force: true });
      }
      resolve(code);
    };

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) {
          child.kill("SIGKILL");
        }
      }, 5000).unref();
    }, AGENT_TIMEOUT_MS);

    timeoutHandle.unref();

    child.stdout?.pipe(outputStream, { end: false });
    child.stderr?.pipe(outputStream, { end: false });

    child.on("spawn", () => {
      if (options.background && typeof child.pid === "number") {
        writeFileSync(pidFile, `${child.pid}`);
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeoutHandle);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        cleanup(127);
        return;
      }

      cleanup(1);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutHandle);
      if (timedOut) {
        cleanup(124);
        return;
      }

      cleanup(code ?? 1);
    });
  });
}

function logSizeBytes(logPath: string): number {
  if (!existsSync(logPath)) {
    return 0;
  }
  try {
    return statSync(logPath).size;
  } catch {
    return 0;
  }
}

function readLogFrom(logPath: string, offset: number): string {
  if (!existsSync(logPath)) {
    return "";
  }
  try {
    const size = statSync(logPath).size;
    const length = size - offset;
    if (length <= 0) {
      return "";
    }
    const fd = openSync(logPath, "r");
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, offset);
    closeSync(fd);
    return buf.toString("utf8");
  } catch {
    return "";
  }
}

export async function runAgent(
  workDir: string,
  prompt: string,
  logFile: string,
  background: boolean = false,
  role: AgentRole = "developer"
): Promise<number> {
  const logPath = resolveLogPath(workDir, logFile);
  mkdirSync(dirname(logPath), { recursive: true });
  const chain = buildChain(role);

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i] as AgentEntry;
    const label = i === 0 ? `[AGENT] ${role}: trying ${entry.model}\n` : `[AGENT] ${role}: capacity exhausted, trying ${entry.model}\n`;
    appendFileSync(logPath, label, "utf8");
    const offsetBefore = logSizeBytes(logPath);
    const exitCode = await runCommand({
      binary: entry.binary,
      args: entry.buildArgs(prompt, workDir),
      workDir,
      logPath,
      append: true,
      background
    });

    if (entry.capacityMessages.length === 0) {
      return exitCode;
    }

    const newOutput = readLogFrom(logPath, offsetBefore);
    const capacityExhausted = entry.capacityMessages.some(m => newOutput.includes(m));
    if (!capacityExhausted) {
      return exitCode;
    }
  }

  return 1;
}

export function getTaskLogName(taskId: number): string {
  return `${AGENT_LOG_DIR}/agent_task_${taskId}.log`;
}

export function getAuditLogName(taskId: number): string {
  return `${AGENT_LOG_DIR}/agent_audit_${taskId}.log`;
}

export function getPreviousFailureLogName(): string {
  return `${AGENT_LOG_DIR}/PREVIOUS_FAILURE.log`;
}
