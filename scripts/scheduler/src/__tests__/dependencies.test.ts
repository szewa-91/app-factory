import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { SchedulerDatabase } from "../db.js";
import { dependenciesDone } from "../dependencies.js";
import { TaskStatus } from "../types.js";

interface TestDatabase {
  schedulerDb: SchedulerDatabase;
  cleanup: () => void;
}

function createTestDatabase(statusRows: Array<{ id: number; status: TaskStatus }>): TestDatabase {
  const tempDir = mkdtempSync(join(tmpdir(), "scheduler-deps-"));
  const dbPath = join(tempDir, "factory.db");
  const sqlite = new Database(dbPath);

  sqlite.exec(`
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT,
      title TEXT,
      status TEXT DEFAULT 'CREATED',
      priority INTEGER,
      description TEXT,
      created_at DATETIME,
      updated_at DATETIME,
      retry_count INTEGER DEFAULT 0,
      depends_on TEXT,
      audit_notes TEXT
    );
    CREATE TABLE projects (
      name TEXT PRIMARY KEY,
      port INTEGER,
      domain TEXT,
      created_at DATETIME
    );
  `);

  const insertTask = sqlite.prepare(
    "INSERT INTO tasks (id, project_name, title, status, priority, description, retry_count, depends_on, audit_notes) VALUES (?, 'p', 't', ?, 0, '', 0, '', '')"
  );

  for (const row of statusRows) {
    insertTask.run(row.id, row.status);
  }

  sqlite.close();

  const schedulerDb = new SchedulerDatabase(dbPath);
  return {
    schedulerDb,
    cleanup: () => {
      schedulerDb.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

describe("dependenciesDone", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("returns true for empty dependencies", () => {
    const { schedulerDb, cleanup } = createTestDatabase([]);
    cleanups.push(cleanup);

    expect(dependenciesDone("", schedulerDb)).toBe(true);
    expect(dependenciesDone(null, schedulerDb)).toBe(true);
    expect(dependenciesDone(undefined, schedulerDb)).toBe(true);
  });

  it("returns true only when every dependency is DONE", () => {
    const { schedulerDb, cleanup } = createTestDatabase([
      { id: 1, status: TaskStatus.DONE },
      { id: 2, status: TaskStatus.DONE }
    ]);
    cleanups.push(cleanup);

    expect(dependenciesDone("1,2", schedulerDb)).toBe(true);
  });

  it("returns false when a dependency is not DONE or missing", () => {
    const { schedulerDb, cleanup } = createTestDatabase([
      { id: 1, status: TaskStatus.DONE },
      { id: 2, status: TaskStatus.READY }
    ]);
    cleanups.push(cleanup);

    expect(dependenciesDone("1,2", schedulerDb)).toBe(false);
    expect(dependenciesDone("1,999", schedulerDb)).toBe(false);
  });

  it("returns false when dependency token is not a non-negative integer", () => {
    const { schedulerDb, cleanup } = createTestDatabase([{ id: 1, status: TaskStatus.DONE }]);
    cleanups.push(cleanup);

    expect(dependenciesDone("1,abc", schedulerDb)).toBe(false);
    expect(dependenciesDone("1,-2", schedulerDb)).toBe(false);
  });
});
