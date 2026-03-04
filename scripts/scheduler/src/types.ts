export enum TaskStatus {
  CREATED = "CREATED",
  READY = "READY",
  APPROVED = "APPROVED",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  IN_PROGRESS = "IN_PROGRESS",
  AUDITING = "AUDITING",
  DONE = "DONE",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  FAILURE = "FAILURE"
}

export interface Task {
  id: number;
  project_name: string | null;
  title: string | null;
  status: TaskStatus;
  priority: number | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  retry_count: number;
  depends_on: string | null;
  audit_notes: string | null;
}

export interface Project {
  name: string;
  port: number | null;
  domain: string | null;
  created_at: string | null;
}
