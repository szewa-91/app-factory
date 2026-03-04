import { getSchedulerDatabase, SchedulerDatabase } from "./db.js";
import { TaskStatus } from "./types.js";

function isNonNegativeInt(value: string): boolean {
  return /^\d+$/.test(value);
}

export function dependenciesDone(deps: string | null | undefined, database: SchedulerDatabase = getSchedulerDatabase()): boolean {
  if (!deps) {
    return true;
  }

  const depIds = deps
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  for (const depId of depIds) {
    if (!isNonNegativeInt(depId)) {
      return false;
    }

    const status = database.getTaskStatus(Number.parseInt(depId, 10));
    if (status !== TaskStatus.DONE) {
      return false;
    }
  }

  return true;
}
