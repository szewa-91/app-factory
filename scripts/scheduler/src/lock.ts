import { closeSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";

const DEFAULT_LOCK_FILE = process.env.SCHEDULER_LOCK_FILE ?? "/home/szewa/app-factory/scheduler.lock";

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function parsePid(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function tryReadLock(lockFile: string): string | null {
  try {
    return readFileSync(lockFile, "utf8");
  } catch {
    return null;
  }
}

export interface LockAcquireResult {
  acquired: boolean;
  existingPid: number | null;
  stalePid: number | null;
}

export class SchedulerLock {
  private acquired = false;
  private readonly lockFile: string;
  private handlersInstalled = false;

  constructor(lockFile: string = DEFAULT_LOCK_FILE) {
    this.lockFile = lockFile;
  }

  acquire(): LockAcquireResult {
    let existingPid: number | null = null;
    let stalePid: number | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const fd = openSync(this.lockFile, "wx", 0o644);
        writeSync(fd, `${process.pid}\n`);
        closeSync(fd);
        this.acquired = true;
        this.installCleanupHandlers();
        return { acquired: true, existingPid, stalePid };
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== "EEXIST") {
          throw error;
        }

        const lockContents = tryReadLock(this.lockFile);
        existingPid = lockContents === null ? null : parsePid(lockContents);

        if (existingPid !== null && isPidRunning(existingPid)) {
          return { acquired: false, existingPid, stalePid };
        }

        stalePid = existingPid;

        // Only remove the stale lock if the contents are unchanged between reads.
        const confirmContents = tryReadLock(this.lockFile);
        if (lockContents !== null && confirmContents === lockContents) {
          rmSync(this.lockFile, { force: true });
        }
      }
    }

    return { acquired: false, existingPid, stalePid };
  }

  release(): void {
    if (!this.acquired) {
      return;
    }

    rmSync(this.lockFile, { force: true });
    this.acquired = false;
  }

  private installCleanupHandlers(): void {
    if (this.handlersInstalled) {
      return;
    }

    process.once("exit", this.handleExit);
    process.once("SIGINT", this.handleSignal);
    process.once("SIGTERM", this.handleSignal);
    process.once("uncaughtException", this.handleUncaughtException);
    this.handlersInstalled = true;
  }

  private readonly handleExit = (): void => {
    this.release();
  };

  private readonly handleSignal = (): void => {
    this.release();
    process.exit(0);
  };

  private readonly handleUncaughtException = (error: Error): void => {
    this.release();
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exit(1);
  };
}
