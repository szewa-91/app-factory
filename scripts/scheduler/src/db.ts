import Database from "better-sqlite3";
import { TaskStatus } from "./types.js";

const DEFAULT_DB_PATH = process.env.FACTORY_DB_PATH ?? "/home/szewa/app-factory/factory.db";

type StatusRow = { status: string };
type BusyTaskRow = { id: number; project_name: string | null };
type CreatedTaskRow = { id: number; depends_on: string };
type CandidateRow = {
  id: number;
  project_name: string | null;
  title: string;
  description: string;
  retry_count: number;
  depends_on: string;
  status: string;
  priority: number;
  assigned_agent: string | null;
};
type ProjectDomainRow = { domain: string | null };
type AuditNotesRow = { audit_notes: string | null };

export interface BusyTask {
  id: number;
  project_name: string | null;
}

export interface CreatedTask {
  id: number;
  depends_on: string;
}

export interface TaskCandidate {
  id: number;
  project_name: string | null;
  title: string;
  description: string;
  retry_count: number;
  depends_on: string;
  status: TaskStatus;
  priority: number;
  assigned_agent: string | null;
}

const GET_BUSY_TASKS_SQL = `
  SELECT id, project_name
  FROM tasks
  WHERE status IN ('IN_PROGRESS', 'AUDITING')
`;

const GET_TASK_STATUS_SQL = `
  SELECT status
  FROM tasks
  WHERE id = ?
  LIMIT 1
`;

const GET_CREATED_TASKS_SQL = `
  SELECT id, COALESCE(depends_on, '') AS depends_on
  FROM tasks
  WHERE status = 'CREATED'
`;

const GET_READY_OR_APPROVED_CANDIDATES_SQL = `
  SELECT
    id,
    project_name,
    REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(title, ''), CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(31), ' ') AS title,
    REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(description, ''), CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(31), ' ') AS description,
    COALESCE(retry_count, 0) AS retry_count,
    COALESCE(depends_on, '') AS depends_on,
    status,
    COALESCE(priority, 0) AS priority,
    assigned_agent
  FROM tasks
  WHERE status IN ('READY', 'APPROVED')
  ORDER BY COALESCE(priority, 0) DESC, created_at ASC
`;

const GET_PROJECT_DOMAIN_SQL = `
  SELECT domain
  FROM projects
  WHERE name = ?
  LIMIT 1
`;

const GET_TASK_AUDIT_NOTES_SQL = `
  SELECT audit_notes
  FROM tasks
  WHERE id = ?
  LIMIT 1
`;

const UPDATE_TASK_STATUS_PLAIN_SQL = `
  UPDATE tasks
  SET status = ?
  WHERE id = ?
`;

const MOVE_TASK_TO_PENDING_APPROVAL_SQL = `
  UPDATE tasks
  SET status = 'PENDING_APPROVAL', updated_at = ?
  WHERE id = ?
`;

const CLAIM_TASK_SQL = `
  UPDATE tasks
  SET status = 'IN_PROGRESS', updated_at = ?
  WHERE id = ?
    AND status IN ('READY', 'APPROVED')
`;

const MARK_TASK_AUDITING_SQL = `
  UPDATE tasks
  SET status = 'AUDITING', updated_at = ?
  WHERE id = ?
`;

const MARK_TASK_DONE_SQL = `
  UPDATE tasks
  SET status = 'DONE', audit_notes = ?, updated_at = ?
  WHERE id = ?
`;

const MARK_TASK_READY_FOR_RETRY_SQL = `
  UPDATE tasks
  SET status = 'READY', retry_count = retry_count + 1, audit_notes = ?, updated_at = ?
  WHERE id = ?
`;

const MARK_TASK_FAILED_SQL = `
  UPDATE tasks
  SET status = 'FAILED', audit_notes = ?, updated_at = ?
  WHERE id = ?
`;

const MARK_TASK_FAILED_NO_NOTES_SQL = `
  UPDATE tasks
  SET status = 'FAILED', updated_at = ?
  WHERE id = ?
`;

const GET_TRIAGE_TASKS_SQL = `
  SELECT
    id,
    REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(title, ''), CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(31), ' ') AS title,
    REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(description, ''), CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(31), ' ') AS description,
    COALESCE(priority, 0) AS priority
  FROM tasks
  WHERE status = 'TRIAGE'
  ORDER BY created_at ASC
`;

const ASSIGN_TRIAGE_TASK_SQL = `
  UPDATE tasks
  SET assigned_agent = ?, status = ?, updated_at = ?
  WHERE id = ?
    AND status = 'TRIAGE'
`;

type TriageTaskRow = {
  id: number;
  title: string;
  description: string;
  priority: number;
};

export interface TriageTask {
  id: number;
  title: string;
  description: string;
  priority: number;
}

function parseTaskStatus(rawStatus: string): TaskStatus {
  switch (rawStatus) {
    case TaskStatus.CREATED:
    case TaskStatus.TRIAGE:
    case TaskStatus.READY:
    case TaskStatus.APPROVED:
    case TaskStatus.PENDING_APPROVAL:
    case TaskStatus.IN_PROGRESS:
    case TaskStatus.AUDITING:
    case TaskStatus.DONE:
    case TaskStatus.SUCCESS:
    case TaskStatus.FAILED:
    case TaskStatus.FAILURE:
      return rawStatus;
    default:
      throw new Error(`Unexpected task status from database: ${rawStatus}`);
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export class SchedulerDatabase {
  private readonly db: Database.Database;
  private readonly getBusyTasksStmt: Database.Statement<[], BusyTaskRow>;
  private readonly getTaskStatusStmt: Database.Statement<[number], StatusRow>;
  private readonly getCreatedTasksStmt: Database.Statement<[], CreatedTaskRow>;
  private readonly getReadyOrApprovedCandidatesStmt: Database.Statement<[], CandidateRow>;
  private readonly getProjectDomainStmt: Database.Statement<[string], ProjectDomainRow>;
  private readonly getTaskAuditNotesStmt: Database.Statement<[number], AuditNotesRow>;
  private readonly updateTaskStatusPlainStmt: Database.Statement<[TaskStatus, number]>;
  private readonly moveTaskToPendingApprovalStmt: Database.Statement<[string, number]>;
  private readonly claimTaskStmt: Database.Statement<[string, number]>;
  private readonly markTaskAuditingStmt: Database.Statement<[string, number]>;
  private readonly markTaskDoneStmt: Database.Statement<[string, string, number]>;
  private readonly markTaskReadyForRetryStmt: Database.Statement<[string, string, number]>;
  private readonly markTaskFailedStmt: Database.Statement<[string, string, number]>;
  private readonly markTaskFailedNoNotesStmt: Database.Statement<[string, number]>;
  private readonly getTriageTasksStmt: Database.Statement<[], TriageTaskRow>;
  private readonly assignTriageTaskStmt: Database.Statement<[string, TaskStatus, string, number]>;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.db = new Database(dbPath);
    this.getBusyTasksStmt = this.db.prepare(GET_BUSY_TASKS_SQL);
    this.getTaskStatusStmt = this.db.prepare(GET_TASK_STATUS_SQL);
    this.getCreatedTasksStmt = this.db.prepare(GET_CREATED_TASKS_SQL);
    this.getReadyOrApprovedCandidatesStmt = this.db.prepare(GET_READY_OR_APPROVED_CANDIDATES_SQL);
    this.getProjectDomainStmt = this.db.prepare(GET_PROJECT_DOMAIN_SQL);
    this.getTaskAuditNotesStmt = this.db.prepare(GET_TASK_AUDIT_NOTES_SQL);
    this.updateTaskStatusPlainStmt = this.db.prepare(UPDATE_TASK_STATUS_PLAIN_SQL);
    this.moveTaskToPendingApprovalStmt = this.db.prepare(MOVE_TASK_TO_PENDING_APPROVAL_SQL);
    this.claimTaskStmt = this.db.prepare(CLAIM_TASK_SQL);
    this.markTaskAuditingStmt = this.db.prepare(MARK_TASK_AUDITING_SQL);
    this.markTaskDoneStmt = this.db.prepare(MARK_TASK_DONE_SQL);
    this.markTaskReadyForRetryStmt = this.db.prepare(MARK_TASK_READY_FOR_RETRY_SQL);
    this.markTaskFailedStmt = this.db.prepare(MARK_TASK_FAILED_SQL);
    this.markTaskFailedNoNotesStmt = this.db.prepare(MARK_TASK_FAILED_NO_NOTES_SQL);
    this.getTriageTasksStmt = this.db.prepare(GET_TRIAGE_TASKS_SQL);
    this.assignTriageTaskStmt = this.db.prepare(ASSIGN_TRIAGE_TASK_SQL);
  }

  getBusyTasks(): BusyTask[] {
    return this.getBusyTasksStmt.all().map((row) => ({
      id: row.id,
      project_name: row.project_name
    }));
  }

  getTaskStatus(taskId: number): TaskStatus | null {
    const row = this.getTaskStatusStmt.get(taskId);
    if (!row) {
      return null;
    }

    return parseTaskStatus(row.status);
  }

  getCreatedTasks(): CreatedTask[] {
    return this.getCreatedTasksStmt.all().map((row) => ({
      id: row.id,
      depends_on: row.depends_on
    }));
  }

  getReadyOrApprovedCandidates(): TaskCandidate[] {
    return this.getReadyOrApprovedCandidatesStmt.all().map((row) => ({
      id: row.id,
      project_name: row.project_name,
      title: row.title,
      description: row.description,
      retry_count: toNumber(row.retry_count),
      depends_on: row.depends_on,
      status: parseTaskStatus(row.status),
      priority: toNumber(row.priority),
      assigned_agent: row.assigned_agent
    }));
  }

  getTriageTasks(): TriageTask[] {
    return this.getTriageTasksStmt.all().map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      priority: toNumber(row.priority)
    }));
  }

  assignTriageTask(taskId: number, agentRole: string, status: TaskStatus, updatedAt: string): number {
    const result = this.assignTriageTaskStmt.run(agentRole, status, updatedAt, taskId);
    return result.changes;
  }

  getProjectDomain(projectName: string): string | null {
    const row = this.getProjectDomainStmt.get(projectName);
    return row?.domain ?? null;
  }

  getTaskAuditNotes(taskId: number): string {
    const row = this.getTaskAuditNotesStmt.get(taskId);
    return row?.audit_notes ?? "";
  }

  updateTaskStatusPlain(taskId: number, status: TaskStatus): void {
    this.updateTaskStatusPlainStmt.run(status, taskId);
  }

  moveTaskToPendingApproval(taskId: number, updatedAt: string): number {
    const result = this.moveTaskToPendingApprovalStmt.run(updatedAt, taskId);
    return result.changes;
  }

  claimTask(taskId: number, updatedAt: string): number {
    const result = this.claimTaskStmt.run(updatedAt, taskId);
    return result.changes;
  }

  markTaskAuditing(taskId: number, updatedAt: string): void {
    this.markTaskAuditingStmt.run(updatedAt, taskId);
  }

  markTaskDone(taskId: number, auditNotes: string, updatedAt: string): void {
    this.markTaskDoneStmt.run(auditNotes, updatedAt, taskId);
  }

  markTaskReadyForRetry(taskId: number, auditNotes: string, updatedAt: string): void {
    this.markTaskReadyForRetryStmt.run(auditNotes, updatedAt, taskId);
  }

  markTaskFailed(taskId: number, auditNotes: string, updatedAt: string): void {
    this.markTaskFailedStmt.run(auditNotes, updatedAt, taskId);
  }

  markTaskFailedWithoutNotes(taskId: number, updatedAt: string): void {
    this.markTaskFailedNoNotesStmt.run(updatedAt, taskId);
  }

  close(): void {
    this.db.close();
  }
}

const schedulerDatabase = new SchedulerDatabase();

export function getSchedulerDatabase(): SchedulerDatabase {
  return schedulerDatabase;
}

export function closeSchedulerDatabase(): void {
  schedulerDatabase.close();
}
