import { spawnSync } from "node:child_process";

interface CommandResult {
  ok: boolean;
  output: string;
}

function runCommand(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8"
  });

  if (result.error) {
    return { ok: false, output: result.error.message };
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return {
    ok: result.status === 0,
    output
  };
}

function isGitRepository(cwd: string): boolean {
  const probe = runCommand("git", ["rev-parse", "--is-inside-work-tree"], cwd);
  return probe.ok;
}

export function recordPreTaskSha(cwd: string = process.cwd()): string {
  if (!isGitRepository(cwd)) {
    return "";
  }

  const rev = runCommand("git", ["rev-parse", "HEAD"], cwd);
  return rev.ok ? rev.output : "";
}

export function resetToSha(sha: string, cwd: string = process.cwd()): boolean {
  if (!sha || !isGitRepository(cwd)) {
    return false;
  }

  const reset = runCommand("git", ["reset", "--hard", sha], cwd);
  return reset.ok;
}

export function gitHasDirtyState(cwd: string = process.cwd()): boolean {
  if (!isGitRepository(cwd)) {
    return false;
  }

  const status = runCommand("git", ["status", "--porcelain"], cwd);
  return status.ok && status.output.length > 0;
}

export function commitAllChanges(message: string, cwd: string = process.cwd()): boolean {
  if (!isGitRepository(cwd)) {
    return false;
  }

  const add = runCommand("git", ["add", "."], cwd);
  if (!add.ok) {
    return false;
  }

  const commit = runCommand("git", ["commit", "-m", message], cwd);
  return commit.ok;
}
