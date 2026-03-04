# App Factory - Gemini Workspace Guide

Welcome to App Factory. This workspace is an autonomous environment where agents bootstrap, build, audit, and deploy apps from user ideas.

## Project Architecture
- `apps/`: Individual app repositories (each with its own `.git`).
- `templates/default/`: Hardened Next.js + Docker + SQLite + Coolify templates.
- `scripts/bootstrap.sh`: Failure-atomic project bootstrap with deterministic SPECS/task fallback and template integrity checks.
- `scripts/scheduler.sh`: Production cron entrypoint wrapper for the compiled TypeScript scheduler (`scripts/scheduler/dist/index.js`).
- `scripts/scheduler/src/`: TypeScript scheduler source modules (lock handling, cycle orchestration, auditing, failure context).
- `scripts/scheduler-new.sh`: Wrapper template kept in-repo for future scheduler cutovers.
- `factory.db`: SQLite source of truth for projects/tasks.
- `factory.log`: Scheduler and task execution log.

## Scheduler Build
- Rebuild scheduler runtime after changing `scripts/scheduler/src/`:
  `cd scripts/scheduler && npm run build`
- `scripts/scheduler.sh` executes the compiled output at `scripts/scheduler/dist/index.js`.

## Workflow: Idea to Deployment
1. Keep root `PRD.md` and root `SPECS.md` as canonical infrastructure context for `app-factory` tasks.
2. Create app-level `PRD.md` (MVP and market-fit scope).
3. Generate app-level `SPECS.md` before implementation (schema, API, UI, task decomposition).
4. Run `./scripts/bootstrap.sh <app-name> <domain>`.
   - Optional deterministic mode: `APP_FACTORY_SKIP_AI_DECOMPOSITION=1`.
   - Optional runtime proof during bootstrap: `APP_FACTORY_BOOTSTRAP_SMOKE_VERIFY=1` (writes `/home/szewa/app-factory/bootstrap_smoke_<app>.log`).
5. Store atomic tasks in `factory.db` with `depends_on` sequencing.
6. Move tasks through `READY` -> `IN_PROGRESS` -> `AUDITING` -> `DONE`.
7. Run app-level verification through `./verify.sh`.
8. Publish user-facing release guidance in `LAUNCH.md`.

## Task Lifecycle
- `CREATED`: Defined but not activated.
- `READY`: Actionable and queued.
- `PENDING_APPROVAL`: High-risk task waiting manual approval.
- `APPROVED`: Manually approved high-risk task.
- `IN_PROGRESS`: Developer execution.
- `AUDITING`: Auditor pass.
- `DONE`: Verified and complete.
- `FAILED`: Exhausted retry budget or terminal failure.

## Infrastructure Standards
- All apps run in Docker and listen on internal port `3000`.
- Exposure is domain-based via Traefik labels on external `coolify` network.
- Next.js apps must use `standalone` output.
- SQLite data is persisted on mounted host volume.
- **Dashboard operations**: use `factory-dashboard` to edit domains, deploy apps, and manage task workflow via UI instead of manual edits.

## Dashboard Operations
- **Domain changes**: use inline editor in Applications table; auto-syncs to docker-compose.yml, verify.sh, and CLAUDE.md.
- **Deployments**: click Deploy button to trigger `docker compose up -d --build`, which rebuilds and recreates container with latest config.
- **Task workflow**: use Kanban board UI to move tasks through `READY`/`IN_PROGRESS`/`AUDITING`/`DONE` states.

## Headless Agent Rules
1. Create/update `PLAN.md` checklist at task start and during execution.
2. Read `vision/VISION.md` before architectural changes.
3. Never ship placeholder code.
4. Keep commits atomic after successful verification.
5. On retries, analyze `PREVIOUS_FAILURE.log` before changing code.
6. If system logic changes, sync both `README.md` and `GEMINI.md`.
7. Run `./deploy.sh` after code changes in app projects.
8. Use `./verify.sh` as the single app verification entrypoint.
9. Enforce strict HTTPS verification; do not bypass TLS checks with `curl -k`.
10. Ensure every app has `PRD.md` and `SPECS.md`; bootstrap seeds deterministic defaults if AI decomposition fails.
11. Record a concise lesson in `/home/szewa/app-factory/lessons/<task_id>_<timestamp>.md` after each task.
12. For bootstrap/template/scheduler hardening work, provide runtime evidence (not only `bash -n`) via a real bootstrap smoke run.

## Recurring Lessons (Codified)
- Parse risk-gate fields together: scheduler task selection must include both `priority` and `retry_count` with numeric guards.
- Avoid delimiter drift: scheduler task rows use a non-whitespace unit-separator delimiter and sanitize control characters before parsing.
- Keep resource checks best-effort but safe: `top`/`free` parsing falls back to `/proc` before defaulting metrics.
- Keep scheduler parity explicit in TS modules: lock acquisition stays singleton-safe, dependency gating checks `DONE` only, and claiming stays atomic (`status IN ('READY','APPROVED')`).
- Keep scheduler execution parity end-to-end: TS runner must preserve agent timeout/fallback behavior, auditor retry contracts, verification gates, failure diagnostics, and git safety rollback semantics.
- Make bootstrap failure-atomic: rollback both filesystem artifacts and `factory.db` rows on any bootstrap error.
- Keep decomposition deterministic under AI failures: auto-seed `PRD`/`SPECS` and atomic task chains when needed.
- Keep verification trustworthy: strict HTTPS by default, readiness-before-migration, and one authoritative app-level `./verify.sh`.
- Validate templates at generation time: fail bootstrap if unresolved `${APP_NAME}`/`${DOMAIN}`/`${APP_PORT}` tokens remain.
- Keep Docker contexts lean by generating `.dockerignore` in every app to prevent slow, unstable image builds.
- Make hardening auditable: capture smoke execution evidence in `bootstrap_smoke_<app>.log` when smoke mode is enabled.
- Keep dashboard auth tamper-resistant: verify signed `dashboard-session` cookies on every protected request.
- Never allow implicit dashboard credentials: `ADMIN_PASSWORD` must be explicitly set and `DASHBOARD_SESSION_SECRET` must be at least 32 chars.
