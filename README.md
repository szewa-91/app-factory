# App Factory

Autonomous system for bootstrapping, developing, auditing, and deploying Next.js applications on a VPS using Bash, SQLite, Docker, and headless agents.

## Vision Anchor
All architectural changes must remain aligned with [`vision/VISION.md`](vision/VISION.md), especially the local-first, SQLite-first, and Traefik-first constraints.

## Repository Layout
- `apps/`: Generated application repositories.
- `scripts/bootstrap.sh`: Failure-atomic bootstrap (strict shell mode, rollback, deterministic design fallback).
- `scripts/scheduler.sh`: Production cron entrypoint wrapper for the compiled TypeScript scheduler (`scripts/scheduler/dist/index.js`).
- `scripts/scheduler/src/`: TypeScript scheduler source modules (lock handling, cycle orchestration, auditing, failure context).
- `scripts/scheduler-new.sh`: Wrapper template kept in-repo for future scheduler cutovers.
- `templates/default/`: Baseline Docker/deploy/verify templates used by bootstrap.
- `factory.db`: Central task/project queue.
- `lessons/`: Shared technical insights from completed tasks.

## Core Flow
1. Keep root `PRD.md`/`SPECS.md` as canonical App Factory infrastructure context.
2. Define app-level `PRD.md` for the product idea.
3. Generate app-level `SPECS.md` before implementation.
4. Bootstrap app via `./scripts/bootstrap.sh <app-name> <domain>`.
5. Execute tasks from `factory.db` (`READY` -> `IN_PROGRESS` -> `AUDITING` -> `DONE`).
6. Deploy with `./deploy.sh` and verify via app-level `./verify.sh`.
7. Manage projects/tasks via **factory-dashboard** UI at configured domain (default: `https://dashboard.marcinszewczyk.pl`).

## Factory Dashboard
Operational UI for managing projects and tasks:
- **Kanban board**: visualize and drag-drop tasks through workflow states
- **Applications table**: inline domain editing with auto-sync to config files, deploy buttons for rebuild+restart
- **Task detail editor**: modify priority, audit notes, task dependencies
- **Log viewer**: stream app and scheduler logs with live polling
- **Git history**: view recent commits per app

## Scheduler Build
- Rebuild the TypeScript scheduler runtime from source: `cd scripts/scheduler && npm run build`.
- The build output is `scripts/scheduler/dist/index.js`, which is what `scripts/scheduler.sh` executes.

## Hardened Baseline
- Apps listen internally on `3000` and are exposed via Traefik labels on `coolify` network.
- Bootstrap is failure-atomic: errors trigger rollback of app directory plus DB project/task rows.
- Design phase is deterministic: if AI decomposition fails, bootstrap seeds baseline `SPECS.md` and atomic tasks.
- Bootstrap can force deterministic decomposition with `APP_FACTORY_SKIP_AI_DECOMPOSITION=1`.
- Bootstrap supports optional runtime smoke validation via `APP_FACTORY_BOOTSTRAP_SMOKE_VERIFY=1`.
- Smoke mode now performs prerequisite checks up front and writes execution evidence to `bootstrap_smoke_<app>.log`.
- Bootstrap validates rendered templates and fails fast on unresolved `${APP_NAME}`/`${DOMAIN}`/`${APP_PORT}` tokens.
- Bootstrap now seeds `.dockerignore` by default to prevent oversized Docker build contexts.
- Deploy template waits for runtime readiness before `prisma migrate deploy`.
- Deploy/verify templates validate `APP_PORT`, `docker compose` config, and required `coolify` network preconditions.
- Verify template enforces strict HTTPS trust checks (no insecure TLS bypass) and runs unit + Playwright checks.
- Hardening tasks should include runtime evidence (bootstrap + deploy + verify), not syntax checks alone.
- Scheduler keeps risk-gate fields schema-aligned (`priority` + `retry_count`) with control-char-safe delimiter parsing and numeric guardrails.
- Scheduler handles missing/variable host resource tooling output with `top/free` plus `/proc` fallbacks, including fallback-on-parse-failure behavior.
- TypeScript scheduler now mirrors full shell execution flow, including Gemini->Codex agent fallback, retry-aware auditor prompts, verify/health gating, failure-context capture, and retry/FAILED transitions.
- Scheduler treats app-level `./verify.sh` as the authoritative verification path and only uses direct HTTPS probing for legacy projects.
- Factory dashboard auth uses signed, expiring session cookies and rejects unsigned/presence-only cookies.
- Dashboard login fails closed when `ADMIN_PASSWORD` is unset; no insecure default credential fallback is allowed.
- Dashboard signed sessions require `DASHBOARD_SESSION_SECRET` (minimum 32 characters).
- Dashboard domain editing auto-syncs changes to affected project files (docker-compose.yml, verify.sh, CLAUDE.md).
- Dashboard deploy endpoint mounts Docker socket and executes `docker compose up -d --build` for container rebuild/restart.

## Task Statuses
`CREATED`, `READY`, `PENDING_APPROVAL`, `APPROVED`, `IN_PROGRESS`, `AUDITING`, `DONE`, `FAILED`.
