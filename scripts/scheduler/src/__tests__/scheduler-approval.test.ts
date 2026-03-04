import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchedulerDatabase } from "../db.js";
import { runSchedulerCycle } from "../scheduler.js";
import { TaskStatus } from "../types.js";
import { runAuditPipeline } from "../audit.js";
import { runAgent } from "../agent-runner.js";
import { checkResources } from "../resources.js";

vi.mock("../resources.js", () => ({
  checkResources: vi.fn()
}));

vi.mock("../agent-runner.js", () => ({
  getTaskLogName: (taskId: number) => `logs/agents/agent_task_${taskId}.log`,
  getPreviousFailureLogName: () => "logs/agents/PREVIOUS_FAILURE.log",
  runAgent: vi.fn()
}));

vi.mock("../audit.js", () => ({
  runAuditPipeline: vi.fn()
}));

vi.mock("../shared-knowledge.js", () => ({
  readSharedKnowledge: vi.fn(async () => "")
}));

vi.mock("../git-safety.js", () => ({
  recordPreTaskSha: vi.fn(() => ""),
  resetToSha: vi.fn(),
  commitAllChanges: vi.fn(),
  gitHasDirtyState: vi.fn(() => false)
}));

vi.mock("../failure-context.js", () => ({
  captureFailureContext: vi.fn()
}));

interface TestDb {
  schedulerDb: SchedulerDatabase;
  dbPath: string;
  cleanup: () => void;
}

function createTestDb(): TestDb {
  const tempDir = mkdtempSync(join(tmpdir(), "scheduler-approval-"));
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

  sqlite.close();

  const schedulerDb = new SchedulerDatabase(dbPath);
  return {
    schedulerDb,
    dbPath,
    cleanup: () => {
      schedulerDb.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function insertTask(
  databasePath: string,
  task: {
    id: number;
    projectName: string;
    status: TaskStatus;
    retryCount: number;
    priority: number;
    dependsOn?: string;
  }
): void {
  const sqlite = new Database(databasePath);
  const stmt = sqlite.prepare(
    "INSERT INTO tasks (id, project_name, title, status, priority, description, created_at, updated_at, retry_count, depends_on, audit_notes) VALUES (?, ?, 'Task', ?, ?, 'desc', datetime('now'), datetime('now'), ?, ?, '')"
  );
  stmt.run(task.id, task.projectName, task.status, task.priority, task.retryCount, task.dependsOn ?? "");
  sqlite.close();
}

describe("scheduler approval logic", () => {
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    vi.mocked(checkResources).mockResolvedValue({ cpu: 10, ram: 20, skip: false });
    vi.mocked(runAgent).mockResolvedValue(0);
    vi.mocked(runAuditPipeline).mockResolvedValue({ status: "done", reason: "audit_passed" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it("moves app-factory READY retry=0 tasks to PENDING_APPROVAL", async () => {
    const { schedulerDb, dbPath, cleanup } = createTestDb();
    cleanups.push(cleanup);

    insertTask(dbPath, {
      id: 1,
      projectName: "app-factory",
      status: TaskStatus.READY,
      retryCount: 0,
      priority: 5
    });

    const result = await runSchedulerCycle(schedulerDb);

    expect(result.status).toBe("dependencies_blocked");
    expect(schedulerDb.getTaskStatus(1)).toBe(TaskStatus.PENDING_APPROVAL);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("runs app-factory task when retry_count is already > 0", async () => {
    const { schedulerDb, dbPath, cleanup } = createTestDb();
    cleanups.push(cleanup);

    insertTask(dbPath, {
      id: 2,
      projectName: "app-factory",
      status: TaskStatus.READY,
      retryCount: 1,
      priority: 5
    });

    const result = await runSchedulerCycle(schedulerDb);

    expect(result.status).toBe("done");
    expect(result.taskId).toBe(2);
    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(runAuditPipeline).toHaveBeenCalledTimes(1);
  });

  it("runs READY tasks when priority is below approval threshold", async () => {
    const { schedulerDb, dbPath, cleanup } = createTestDb();
    cleanups.push(cleanup);

    insertTask(dbPath, {
      id: 3,
      projectName: "demo-app",
      status: TaskStatus.READY,
      retryCount: 0,
      priority: 9
    });

    const result = await runSchedulerCycle(schedulerDb);

    expect(result.status).toBe("done");
    expect(result.taskId).toBe(3);
    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(runAuditPipeline).toHaveBeenCalledTimes(1);
  });
});
