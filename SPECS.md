# SPECS - App Factory Infrastructure (Canonical Root Spec)

## 1. Purpose
Define the canonical technical specification for the App Factory infrastructure so headless scheduler prompts that reference root `PRD.md` and `SPECS.md` always have stable, system-wide context.

## 2. Scope
This spec covers the factory control plane in `/home/szewa/app-factory`:
- Bootstrap pipeline (`scripts/bootstrap.sh`).
- Scheduler/orchestration pipeline (`scripts/scheduler.sh` and `scripts/scheduler/`).
- Central SQLite queue (`factory.db`).
- Root verification and operational artifacts (`verify.sh`, `factory.log`, `lessons/`).
- Dashboard API surface (`apps/factory-dashboard/app/api/*`).

Per-app product implementation details belong in each app's local `PRD.md` and `SPECS.md`.

## 3. Architecture
- `factory.db`: source of truth for projects/tasks and task lifecycle.
- `scripts/bootstrap.sh`: scaffolds Next.js apps, seeds baseline docs/tasks when AI decomposition is unavailable, and performs failure-atomic rollback.
- `scripts/scheduler.sh`: single-cycle queue executor with lock handling, dependency checks, risk gate, agent execution, audit flow, retries, and verification.
- `scripts/scheduler/`: scheduler rewrite implementation area and parity spec.
- `templates/default/`: hardened app template assets (Docker/deploy/verify and build-context hygiene).
- `apps/factory-dashboard`: operational UI + APIs backed by Prisma over the same SQLite DB.
- `verify.sh` (root): infrastructure health check baseline.

## 4. Data Model (Canonical)
`factory.db` schema:

```sql
CREATE TABLE projects (
  name TEXT PRIMARY KEY,
  port INTEGER,
  domain TEXT,
  created_at DATETIME
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT,
  title TEXT,
  status TEXT DEFAULT 'CREATED' CHECK (
    status IN (
      'CREATED','READY','APPROVED','PENDING_APPROVAL',
      'IN_PROGRESS','AUDITING','DONE','SUCCESS','FAILED','FAILURE'
    )
  ),
  priority INTEGER,
  description TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  retry_count INTEGER DEFAULT 0,
  depends_on TEXT,
  audit_notes TEXT
);
```

Operational status set used by scheduler flow:
- `CREATED`, `READY`, `PENDING_APPROVAL`, `APPROVED`, `IN_PROGRESS`, `AUDITING`, `DONE`, `FAILED`.

## 5. Scheduler Contracts
Single scheduler cycle must preserve this order:
1. Reconcile stale `IN_PROGRESS`/`AUDITING` work using lock and PID checks.
2. Promote dependency-satisfied `CREATED` tasks to `READY`.
3. Stop early when CPU or RAM usage exceeds 80%.
4. Select candidate from `READY`/`APPROVED` ordered by `priority DESC, created_at ASC`.
5. Apply risk gate (`project_name='app-factory'` or `priority >= 10`) on first attempt; move to `PENDING_APPROVAL`.
6. Atomically claim task to `IN_PROGRESS`.
7. Run Developer phase, then Auditor phase on success.
8. Run verification (`./verify.sh` if executable; HTTPS fallback for legacy projects without verify script).
9. On failures/timeouts, capture `PREVIOUS_FAILURE.log` and retry up to 3 attempts, then `FAILED`.

Detailed parity requirements remain in `scripts/scheduler/SPECS.md`.

## 6. Bootstrap Contracts
- Input: `./scripts/bootstrap.sh <app-name> <domain>`.
- Validates required tooling and naming constraints.
- Generates Next.js + Prisma + test baseline in `apps/<app-name>`.
- Renders template files and fails if unresolved `${APP_NAME}`, `${DOMAIN}`, `${APP_PORT}` tokens remain.
- Seeds baseline app-level `PRD.md`/`SPECS.md` and atomic `CREATED` tasks if decomposition tools fail.
- Rollback on bootstrap failure removes both filesystem artifacts and DB rows for that project.

## 7. Dashboard API Contracts
Authentication model:
- Middleware enforces signed-session auth for non-public routes.
- `dashboard-session` cookie is HMAC-SHA256 signed and expiry-bound.
- `DASHBOARD_SESSION_SECRET` is required and must be at least 32 characters.
- Protected routes fail closed when auth secret is missing.
- Public routes: `/login`, `/api/login`, `/api/logout`.

Endpoints:
- `POST /api/login`
  - Body: `{ "password": string }`
  - `200`: `{ success: true }` + sets `dashboard-session` cookie
  - `401`: `{ success: false }`
  - `500`: `{ success: false, message: "Dashboard authentication is not configured" }` when `ADMIN_PASSWORD` or `DASHBOARD_SESSION_SECRET` is missing/invalid
- `POST /api/logout`
  - `200`: `{ success: true }` + clears cookie
- `GET /api/projects`
  - `200`: array of project rows ordered by `created_at desc`
- `GET /api/projects/:name`
  - `200`: project row
  - `404`: `{ error: "Project not found" }`
- `PATCH /api/projects/:name`
  - Body: partial project fields
  - On `domain` change: automatically updates docker-compose.yml labels, verify.sh PUBLIC_URL, and CLAUDE.md Domain field
  - `200`: updated project row
  - `404`: `{ error: "Project not found" }`
- `POST /api/projects/:name/deploy`
  - Executes `docker compose up -d --build --remove-orphans` in the app's directory
  - Rebuilds Docker image and recreates container with latest config
  - `200`: `{ ok: true, message: "Container recreated", stdout, stderr }`
  - `404`: `{ error: "No docker-compose.yml found for '...'" }`
  - `500`: deployment error with stderr output
- `GET /api/tasks?project_name=<name|all>`
  - `200`: array of tasks ordered by `created_at desc`
- `GET /api/tasks/:id`
  - `200`: task row
  - `400`: invalid ID
  - `404`: task not found
- `PATCH /api/tasks/:id`
  - Body: partial task fields
  - `200`: updated task row
  - `400`: invalid ID
  - `404`: task not found
- `DELETE /api/tasks/:id`
  - `200`: `{ ok: true }`
  - `400`: invalid ID
  - `404`: task not found
- `GET /api/logs?type=<factory|task|agent>&project=<name>&task_id=<id>&lines=<n>&offset=<bytes>`
  - Streams or tails `.log` files under base workspace path
  - `400`: invalid query
  - `403`: unauthorized path attempt
  - `404`: log missing

## 8. Verification and Operations
- Root verification entrypoint: `/home/szewa/app-factory/verify.sh`.
- Checks DB readability, critical scripts executability, and template presence.
- Scheduler logs to `factory.log`; per-task logs live in `agent_task_<id>.log` and `agent_audit_<id>.log`.
- Lessons must be written to `lessons/<task_id>_<timestamp>.md`.

## 9. Documentation Contracts
For app-factory infrastructure tasks:
- Root `PRD.md` is canonical product context.
- Root `SPECS.md` is canonical technical context.
- If system behavior changes, update `README.md` and `GEMINI.md` in the same task.
- If scheduler behavior changes, update `scripts/scheduler/SPECS.md` for parity accuracy.

## 10. Detailed Task Decomposition Template (Infra Work)
1. Re-read `vision/VISION.md` and root `PRD.md`/`SPECS.md` before changes.
2. Create/update root `PLAN.md` with prioritized checklist.
3. Collect ground truth from scripts, DB schema, and relevant API routes.
4. Implement scoped infra changes without placeholders.
5. Run applicable verification (`./verify.sh` for root infra changes).
6. Execute auditor pass and resolve critical findings.
7. Update docs (`README.md`, `GEMINI.md`, specs) when behavior changes.
8. Write `TASK_SUMMARY.md` (1-3 sentences) and one lesson artifact in `lessons/`.

## 11. Acceptance Criteria
- Root `PRD.md` and root `SPECS.md` exist and describe app-factory infrastructure (not a single subproject effort).
- Root `SPECS.md` includes concrete database schema and dashboard API contracts.
- Scheduler prompt assumption ("Refer to PRD.md for full context") is valid for `app-factory` tasks.
- Documentation remains aligned with `vision/VISION.md` and current script behavior.
