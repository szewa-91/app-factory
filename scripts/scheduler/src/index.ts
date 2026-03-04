import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { closeSchedulerDatabase } from "./db.js";
import { SchedulerLock } from "./lock.js";
import { runSchedulerCycle } from "./scheduler.js";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR ?? "/home/szewa/app-factory";
const LOG_FILE = process.env.FACTORY_LOG_FILE ?? `${WORKSPACE_DIR}/factory.log`;

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function log(message: string): void {
  const line = `[${nowIso()}] ${message}`;
  process.stdout.write(`${line}\n`);
  appendFileSync(LOG_FILE, `${line}\n`);
}

export async function main(): Promise<void> {
  const lock = new SchedulerLock();
  const lockResult = lock.acquire();

  if (!lockResult.acquired) {
    const pidSuffix = lockResult.existingPid !== null ? ` (PID: ${lockResult.existingPid})` : "";
    log(`[LOCK] Scheduler already running${pidSuffix}. Exiting.`);
    return;
  }

  try {
    await runSchedulerCycle();
  } finally {
    closeSchedulerDatabase();
    lock.release();
  }
}

const isEntrypoint = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isEntrypoint) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
}
