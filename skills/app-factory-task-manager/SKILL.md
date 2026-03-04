# App Factory Task Manager - Expert Skill (SQLite Edition)

This skill provides expert guidance for managing the application development lifecycle through a centralized SQLite database (`factory.db`).

## <instructions>
### 1. Database Schema
Tasks are stored in the `tasks` table with the following key columns:
- `id`: Unique identifier.
- `project_name`: Name of the app in `apps/`.
- `status`: `CREATED`, `READY`, `IN_PROGRESS`, `DONE`, `FAILED`, `BLOCKED`.
- `priority`: Integer (higher = sooner).
- `depends_on`: Space-separated list of Task IDs that must be `DONE` before this task can start.
- `retry_count`: Tracked automatically by the scheduler (max 3 retries).

### 2. Task Management Workflow
When asked to manage tasks, use `sqlite3 factory.db "<query>"`:
- **Create Task**:
  `INSERT INTO tasks (project_name, title, description, priority, status, depends_on, created_at) VALUES ('my-app', 'Setup Auth', 'Implement Lucia auth', 10, 'CREATED', '1 2', datetime('now'));`
- **Activate Task**:
  `UPDATE tasks SET status = 'READY' WHERE id = 5;`
- **View Status**:
  `SELECT id, status, retry_count FROM tasks WHERE project_name = 'my-app';`

### 3. Dependency Management
- If Task B depends on Task A, Task B should stay in `CREATED` or `READY` status, but the scheduler will only pick it up once Task A is `DONE`.
- Use the `depends_on` field to link tasks.

### 4. Recovery & Health Check
- The scheduler handles up to 3 retries for timeouts or agent errors.
- After a successful agent run, the scheduler performs a **Health Check** (HTTPS GET). If the health check fails, the task is marked as `FAILED`.
- If a task fails permanently, investigate the logs in `factory.log`.
</instructions>

## <available_resources>
- `factory.db`: Central database.
- `factory.log`: Execution logs.
- `scripts/scheduler.sh`: The autonomous executor.
</available_resources>
