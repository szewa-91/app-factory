# TypeScript Scheduler Rewrite - SPECS

## 1. Goal and Scope
Rewrite `/home/szewa/app-factory/scripts/scheduler.sh` as a standalone Node.js TypeScript scheduler process with **behavioral parity**.

Source of truth: `/home/szewa/app-factory/scripts/scheduler.sh` (652 lines).

This scheduler is infrastructure runtime code and must **not** run inside the Next.js app.

## 2. Runtime and Build Contract
- Runtime type: standalone Node.js process.
- TypeScript baseline: align with `apps/factory-dashboard/package.json`:
  - `typescript: ^5`
  - `@types/node: ^20`
- Build output path (required):
  - `/home/szewa/app-factory/scripts/scheduler/dist/index.js`

## 3. File and Module Architecture
Implementation root: `/home/szewa/app-factory/scripts/scheduler/`

Required modules:
1. `src/db.ts`
- Owns all `factory.db` access via typed `better-sqlite3` statements.
- Encodes every query/update now performed by `scheduler.sh`.
- Exposes task/project fetch, claim, transition, retry/failure updates.

2. `src/resources.ts`
- Implements CPU/RAM sampling and overload gating.
- Preserves shell fallback logic (`top`/`proc`, `free`/`meminfo`) and threshold behavior.

3. `src/agent-runner.ts`
- Encapsulates Gemini-first execution with Codex fallback.
- Handles timeout, background execution mode, PID file lifecycle, and exit code propagation.

4. `src/scheduler.ts`
- Implements one full scheduler cycle (state machine):
  - stale lock/agent reconciliation
  - task activation
  - risk gate
  - claim
  - Developer phase
  - Auditor phase
  - verify/health checks
  - retry/failure handling
  - launch note generation

5. `src/index.ts`
- Entrypoint only.
- Applies singleton lock file behavior.
- Executes one scheduler cycle.
- Ensures lock cleanup on exit/signals.

## 4. Schema-Mirrored Types
Types must mirror `factory.db` column names and status values.

### 4.1 `TaskStatus` enum
```ts
export enum TaskStatus {
  CREATED = 'CREATED',
  READY = 'READY',
  APPROVED = 'APPROVED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  IN_PROGRESS = 'IN_PROGRESS',
  AUDITING = 'AUDITING',
  DONE = 'DONE',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  FAILURE = 'FAILURE',
}
```

### 4.2 `Task` interface
```ts
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
```

### 4.3 `Project` interface
```ts
export interface Project {
  name: string;
  port: number | null;
  domain: string | null;
  created_at: string | null;
}
```

## 5. Exact Behavioral Parity with `scripts/scheduler.sh`
No workflow redesign is allowed. Preserve shell behavior branch-for-branch.

### 5.1 Constants and paths
- Workspace: `/home/szewa/app-factory`
- DB: `/home/szewa/app-factory/factory.db`
- Log: `/home/szewa/app-factory/factory.log`
- Lock: `/home/szewa/app-factory/scheduler.lock`
- Max retries: `3`
- Gemini bin: `/home/szewa/.npm-global/bin/gemini`
- Codex bin: `/home/szewa/.npm-global/bin/codex`

### 5.2 Lock file logic (must match)
- If lock file exists and PID is alive: log and exit `0`.
- If lock file exists but PID is dead: remove stale lock and continue.
- Write current PID into lock file.
- Remove lock on `EXIT`, `INT`, and `TERM` equivalent process events.

### 5.3 PID tracking and busy reconciliation (must match)
Before selecting new work:
- Fetch tasks in `IN_PROGRESS` or `AUDITING`.
- Resolve PID file path:
  - `app-factory` -> `/home/szewa/app-factory/agent.pid`
  - other project -> `/home/szewa/app-factory/apps/<project>/agent.pid`
- Re-read DB status for task ID.
- If status is `AUDITING`: log busy and exit `0`.
- If status is `IN_PROGRESS` and PID exists and alive: log busy and exit `0`.
- If status is `IN_PROGRESS` and PID missing/dead: reset task to `READY`; remove stale pid file when present.

### 5.4 Dependency semantics (must match)
- `depends_on` is comma-separated task IDs.
- Empty/null means no dependencies.
- Any non-integer token fails dependency check.
- Dependency is satisfied only when every referenced task has status `DONE`.

### 5.5 CREATED activation (must match)
- `CREATED` tasks with no dependencies -> set to `READY`.
- `CREATED` tasks with all dependencies done -> set to `READY`.
- Others remain `CREATED`.

### 5.6 Resource guard (must match)
- Threshold is `80%`.
- Compute CPU and RAM with shell-equivalent fallback order.
- If CPU `> 80` or RAM `> 80`: log overload and exit `0` without claiming work.

### 5.7 Task candidate scan and PENDING_APPROVAL flow (must match)
- Fetch tasks where `status IN ('READY','APPROVED')` ordered by `priority DESC, created_at ASC`.
- Iterate in order and skip tasks with unsatisfied dependencies.
- Validate `retry_count` and `priority` as non-negative integers; default to `0` if invalid.
- Risk rule:
  - `requiresApproval = (project_name === 'app-factory' || priority >= 10)`
  - If task is `READY`, `retry_count == 0`, and `requiresApproval == true`:
    - set task status to `PENDING_APPROVAL`
    - set `updated_at` to current UTC timestamp
    - continue scanning remaining candidates in same cycle
- Select first remaining eligible candidate.

### 5.8 Atomic claim and race behavior (must match)
- Claim query must only succeed for status in `READY` or `APPROVED`.
- If rows changed is `0`: treat as race, log, and exit `0`.

### 5.9 Developer phase (must match)
- Compose prompt with:
  - `TASK` and `DESCRIPTION`
  - `Refer to PRD.md for full context.`
  - recent lessons (up to 5 newest, each preview capped to 200 chars)
  - mandatory instruction to write `TASK_SUMMARY.md` and lesson file `/home/szewa/app-factory/lessons/<id>_<timestamp>.md`
- If `retry_count > 0` and `PREVIOUS_FAILURE.log` exists, append self-healing diagnostic context capped at 12,000 chars.
- Set `APP_FACTORY_HEADLESS=true` before agent execution.
- Run agent with 30-minute timeout and task log file `agent_task_<id>.log`.

### 5.10 Agent fallback behavior (must match)
- Primary command: Gemini (`--yolo`).
- If log contains `You have exhausted your capacity on this model`, run Codex fallback:
  - `codex exec --dangerously-bypass-approvals-and-sandbox -C <workDir> <prompt>`
- Background mode:
  - write `<workDir>/agent.pid`
  - wait for child
  - delete pid file on completion

### 5.11 Exit-code branching parity (must match)
- Exit `127`: mark task `FAILED`; scheduler exits non-zero.
- Exit `0`: transition to audit flow.
- Exit `124`: timeout branch.
- Any other non-zero: failure branch.

For timeout/non-zero failures:
- capture failure context
- for `app-factory` project, reset to pre-task SHA
- if `retry_count < 3`: set `READY`, increment retry, write reason to `audit_notes`
- else: set `FAILED` with max-retries note

### 5.12 Audit phases parity (must match)
- On Developer success:
  - set status to `AUDITING`
  - run auditor prompt and write `agent_audit_<id>.log`
- First audit attempt (`retry_count == 0`): allows failing non-critical issues.
- Retry audit (`retry_count > 0`): fail only for critical unresolved issues per current prompt contract.
- Audit pass rule: `AUDIT_RESULT.md` contains `AUDIT_PASSED`.
- Audit notes persisted with shell-equivalent truncation semantics.

### 5.13 Verification and completion parity (must match)
On audit pass:
- sleep 5 seconds.
- If executable `./verify.sh` exists: run it (authoritative).
- Else if no verify script and project domain exists: HTTP probe `https://<domain>`.
- If verification passes:
  - set task `DONE`
  - persist `audit_notes` and `updated_at`
  - run launch prompt and append launch log to task log
  - for `app-factory` only: commit dirty git state (`git add . && git commit -m "Task [ID]: TITLE (Audited)"`)
  - cleanup: `PREVIOUS_FAILURE.log`, `TASK_SUMMARY.md`, `AUDIT_RESULT.md`
- If verification fails:
  - capture failure context
  - app-factory reset to pre-task SHA
  - retry-or-fail via max retry policy

### 5.14 Failure context capture parity (must match)
Write `/home/szewa/app-factory/PREVIOUS_FAILURE.log` containing shell-equivalent sections:
- failure reason, timestamp, working dir
- disk/memory snapshot
- directory listing/tree snapshot
- git status + staged diff + unstaged diff + recent commits (if git repo)
- docker ps + docker stats + compose logs when available
- tails of `agent_task_<id>.log` and `agent_audit_<id>.log`

## 6. `db.ts` Query Surface
`db.ts` must expose typed methods for all scheduler SQL operations, including:
- task scans: `IN_PROGRESS/AUDITING`, `CREATED`, `READY/APPROVED`
- dependency status reads
- pending approval transitions
- atomic claim to `IN_PROGRESS`
- status updates for `AUDITING`, `DONE`, `READY+retry`, `FAILED`
- project domain lookup
- audit notes lookup

All SQL must use prepared statements and bound parameters.

## 7. Entrypoint and Wrapper Contract
### 7.1 TypeScript entrypoint
- `scripts/scheduler/src/index.ts` is the runtime entrypoint.
- Build artifact: `scripts/scheduler/dist/index.js`.

### 7.2 Thin shell wrapper
`/home/szewa/app-factory/scripts/scheduler.sh` is reduced to:

```bash
#!/bin/bash
node /home/szewa/app-factory/scripts/scheduler/dist/index.js
```

No additional scheduler logic remains in bash.

## 8. Parity Acceptance Criteria
Implementation is accepted only if all are true:
1. Module structure matches Section 3.
2. Types match Section 4 and `factory.db` schema naming.
3. Runtime behavior matches Section 5 (lock, PID, approval flow, audit phases, retries, and verify behavior).
4. Build emits `scripts/scheduler/dist/index.js`.
5. `scripts/scheduler.sh` is a thin Node wrapper exactly as defined.
