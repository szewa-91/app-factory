# 🚀 What's New: App Factory Enhancements

## Task 22: E2E Testing Integration
We've significantly upgraded the application bootstrapping and verification process to ensure every app created by the Factory is production-ready and battle-tested from day one.

### 🛠️ Built-in Testing Frameworks
All new applications now come pre-configured with industry-standard testing tools:
- **Vitest**: Blazing fast unit testing for your components and logic.
- **Playwright**: Robust End-to-End (E2E) testing to simulate real user interactions across different browsers.

### 🔍 Automated Verification Loop
The `verify.sh` script has been enhanced with an intelligent verification loop. It now:
1. **Waits for Availability**: Automatically polls the public URL of your deployed application until it becomes responsive.
2. **Runs E2E Tests**: Executes Playwright tests against the *live* deployment to confirm that the core user experience is intact.
3. **Handles SSL Gracefully**: Configured to ignore temporary HTTPS errors during the initial Let's Encrypt certificate issuance, preventing false negatives.

## Task 17: Documentation Sync Routine
We've implemented a robust documentation synchronization system to ensure that the project's vision, mandates, and technical state remain consistent across all files and agents.

### ⚓ Vision Anchors
Introduced `vision/VISION.md` as the "North Star" for the App Factory. This file serves as an absolute anchor for all autonomous architectural decisions, ensuring the system remains true to its core principles as it evolves.

### 🔄 Surgical Documentation Sync
The Factory now automatically synchronizes key documentation files like `GEMINI.md` and `README.md`. This eliminates "knowledge drift," ensuring that both human developers and AI agents always have access to the most up-to-date system instructions.

### 🧹 Documentation Debt Resolution
A new refactoring routine identifies and fixes "documentation debt"—such as broken links, redundant instructions, or inconsistent numbering—maintaining a clean and professional documentation suite.

### 🤖 Agent-Optimized Context
Documentation is now specifically structured to provide AI agents with high-signal context, including explicit instructions on how to utilize the Self-Healing system and Git Safety Net during task execution.

## Task 15/17: Self-Healing & Git Safety Net
We've introduced advanced resilience mechanisms to the App Factory's core scheduler, making the autonomous development process more robust and self-correcting.

### 🩹 Self-Healing System
The Factory now learns from its mistakes. If a task fails, the scheduler:
1. **Captures Context**: Automatically gathers logs, system resource stats, and directory states into a `PREVIOUS_FAILURE.log`.
2. **Injects Diagnostics**: Provides this comprehensive failure context to the next agent attempt, allowing it to "see" why the previous run failed and implement a targeted fix.

### 🛡️ Git Safety Net
To protect the integrity of the Factory's infrastructure, we've implemented an automated version control safety net:
1. **Pre-task Snapshot**: The scheduler records the system state (Git SHA) before any infrastructure-level task begins.
2. **Automatic Rollback**: If a task fails verification or audit, the system automatically performs a `git reset --hard` to revert to the last known good state, preventing broken code from lingering in the system.
3. **Atomic Commits**: Successful tasks are automatically committed with a descriptive message, maintaining a clean and traceable audit trail.

### 📊 Intelligent Resource Monitoring
The scheduler now actively monitors VPS CPU and RAM usage. To ensure system stability, it will automatically skip task execution if resource usage exceeds 80%, preventing overload during peak periods.

## Task 31: Architectural Synthesis & Template Hardening
This release hardens the app-generation baseline so new projects are safer, cleaner, and more reliable from the first deploy.

### ✅ More Reliable Bootstrap
- **Deterministic setup mode**: You can now force baseline SPECS/task generation with `APP_FACTORY_SKIP_AI_DECOMPOSITION=1` for predictable project bootstraps.
- **Template integrity checks**: Bootstrap now validates generated files and fails fast if any required template token is left unresolved.
- **Smoke preflight checks**: When smoke mode is enabled, required Docker/Coolify prerequisites are validated before long-running steps begin.

### 🧼 Cleaner, Faster Container Builds
- **Default `.dockerignore` generation**: New apps now include a hardened `.dockerignore` to reduce Docker build context size and avoid shipping unnecessary local artifacts.

### 🔒 Stronger Deployment & Verification Safety
- **Port/config/network validation**: Deploy and verify scripts now validate `APP_PORT`, Docker Compose config, and required `coolify` network presence up front.
- **Stricter HTTPS probing**: Public checks now enforce HTTPS-only + TLS minimums to keep trust verification strict by default.
- **Safer migration execution**: Deployment uses pinned local Prisma tooling behavior to avoid accidental toolchain drift.

### 🧾 Auditable Runtime Proof
- **Smoke evidence logs**: Optional bootstrap smoke runs now write proof logs to `bootstrap_smoke_<app>.log`, so hardening changes are verifiable in real runtime conditions.

## Task 69: TypeScript Scheduler - SPECS & Architecture Design
This release adds a production-grade blueprint for migrating the scheduler from Bash to TypeScript without changing how your Factory behaves.

### 🆕 What's New
- **Parity-first architecture spec**: A full technical design now maps every critical scheduler behavior (task lifecycle, approvals, auditing, retries, verification, and safety nets) to typed TypeScript modules.
- **Stronger security baseline by design**: The new spec requires bound SQL parameters and `shell: false` process execution patterns to reduce command/SQL injection risk during implementation.
- **Deterministic parity test matrix**: 20 required scenarios are now defined to validate lock handling, PID recovery, approval gates, retry logic, audit outcomes, and failure recovery before cutover.
- **Clear migration compatibility path**: The design preserves cron/systemd operation through a thin `scheduler.sh` wrapper that launches the compiled TypeScript scheduler.
- **Better long-term maintainability**: Scheduler responsibilities are decomposed into focused modules (`db`, `resources`, `agent-runner`, `scheduler`, `index`) for safer updates and easier troubleshooting.

## Task 34: Backfill Root PRD/SPECS for Factory Infra
This release improves operational consistency by making root-level infrastructure requirements explicit and stable for all Factory tasks.

### 🆕 What's New
- **Canonical root source of truth**: Root `PRD.md` and a new root `SPECS.md` now define App Factory infrastructure mission, architecture, task lifecycle contracts, and acceptance criteria.
- **Documented database and API contracts**: The canonical spec now includes the `factory.db` schema and concrete dashboard endpoint behaviors so agents and auditors work from the same rules.
- **Stronger dashboard auth guarantees**: Specs now enforce signed, expiring `dashboard-session` cookies, require `DASHBOARD_SESSION_SECRET` (minimum 32 chars), and require login to fail closed when auth secrets are missing.
- **Deterministic error behavior**: Missing project updates are now explicitly standardized as `404` responses (including `PATCH /api/projects/:name`) to keep dashboard behavior predictable.
- **Reduced documentation drift**: `README.md` and `GEMINI.md` were aligned with these contracts so runtime behavior and guidance stay synchronized.

## Task 70: TypeScript Scheduler - Scaffold + DB Layer
This release delivers the first working TypeScript runtime foundation for the scheduler migration, focused on safe database handling and real task claiming behavior.

### 🆕 What's New
- **Working TypeScript scheduler entrypoint**: The new scheduler runtime now performs a real scheduling cycle by claiming a `READY` task and moving it to `IN_PROGRESS` instead of running as a placeholder scaffold.
- **Safer task updates in the database layer**: Scheduler DB writes now validate that exactly one row changed, so missing or stale tasks fail fast instead of silently appearing successful.
- **Hardened SQL execution model**: Database operations now use bound parameters with prepared statements, reducing injection risk and making scheduler behavior more predictable.
- **Strong typed data contracts**: Shared TypeScript task/project models now mirror the live `factory.db` schema, reducing state/field mismatch bugs during the Bash-to-TypeScript transition.
- **Production-ready build scaffold for next steps**: The TypeScript scheduler package now includes strict compiler settings and build/typecheck scripts, enabling safer incremental rollout of full parity features.

## Task 69 Update: What's New for You
Task 69 delivered the architecture and implementation blueprint for moving the scheduler from Bash to TypeScript, with reliability and safety as the top priorities.

### 🆕 What's New
- **A clear migration plan with no behavior surprises**: The new design keeps existing task flow, approvals, audits, retries, and verification behavior consistent during the transition.
- **Safer execution standards built into the design**: The architecture requires secure SQL parameter handling and safer process execution patterns before implementation proceeds.
- **A full parity checklist before rollout**: 20 required validation scenarios are defined so lock handling, stuck-task recovery, approval gates, and failure retries are proven before cutover.
- **Structured modules for faster fixes and updates**: The scheduler design is split into focused components, making future improvements easier and less risky.
- **Compatibility with current operations**: Existing cron/systemd usage is preserved through a wrapper approach, so migration can happen without changing how the scheduler is triggered.

## Task 70 Update: What's New for You
Task 70 ships the first live TypeScript scheduler runtime and database layer improvements, so work starts more reliably and status changes are safer.

### 🆕 What's New
- **Real task pickup is now live in TypeScript**: The scheduler now actively claims `READY` tasks and moves them to `IN_PROGRESS`, instead of running as scaffold-only code.
- **More trustworthy task state updates**: Database updates now fail fast when no row is changed, which helps prevent silent task-state errors.
- **Safer database operations by default**: Task and project queries now use prepared statements with bound parameters for more predictable and secure behavior.
- **Stronger consistency across scheduler and database**: Typed Task/Project models now match the actual `factory.db` schema fields, reducing mismatch bugs.
- **Cleaner foundation for upcoming scheduler migration phases**: The package now includes strict TypeScript build/typecheck scaffolding to support safer incremental feature rollout.

## Task 71 Update: What's New for You
Task 71 delivers the full TypeScript scheduler core loop, so task orchestration is now safer, smarter, and closer to shell parity.

### 🆕 What's New
- **Automatic stuck-task recovery**: The scheduler now detects stale `IN_PROGRESS` tasks (dead/missing PID) and returns them to `READY`, reducing manual intervention.
- **Dependency-aware task activation**: `CREATED` tasks are automatically promoted to `READY` once all required dependencies are `DONE`.
- **Safer approval gating for risky work**: First-run high-risk tasks (infra project tasks or priority `>= 10`) are moved to `PENDING_APPROVAL` before execution.
- **Resource-aware execution decisions**: CPU and RAM are sampled from `/proc`, and new work is skipped when load is above the safety threshold.
- **Stronger single-run and claim safety**: Lock acquisition is now atomic with stale-lock recovery, and task claiming is atomic to prevent double execution during races.
- **Verified reliability baseline**: Core-loop dependency and resource behavior now has unit coverage, and scheduler build/typecheck/tests all pass.

## Task 72 Update: What's New for You
Task 72 completes the end-to-end TypeScript scheduler execution path, adding production-ready agent running, auditing, verification, and retry handling.

### 🆕 What's New
- **Full Developer -> Auditor -> Verify flow is now live in TypeScript**: Tasks now move through implementation, audit review, and verification in one consistent runtime loop before being marked `DONE`.
- **More resilient agent execution**: The runner enforces a 30-minute timeout, writes structured task/audit logs, and automatically falls back from Gemini to Codex if Gemini capacity is exhausted.
- **Stronger audit behavior across retries**: First-pass audits can request fixes, while retry audits focus on unresolved critical issues and reuse prior audit notes for continuity.
- **Verification is now an explicit completion gate**: The scheduler runs project `./verify.sh` when available (authoritative path) and only falls back to HTTPS probing for legacy cases.
- **Safer failure recovery with self-healing context**: On failures, the system captures `PREVIOUS_FAILURE.log` diagnostics, retries up to policy limits, and preserves clear failure reasons when retries are exhausted.
- **Infrastructure safety and traceability improvements**: For `app-factory` tasks, pre-task Git state is captured for rollback on failed attempts, successful audited changes are auto-committed, and temporary task artifacts are cleaned up.

## Task 73 Update: What's New for You
Task 73 strengthens TypeScript scheduler readiness by validating key safety rules, build output, and runtime startup end-to-end.

### 🆕 What's New
- **Stronger dependency reliability**: New tests confirm tasks only proceed when all required dependency tasks are truly `DONE`, and invalid dependency tokens are safely blocked.
- **More predictable approval behavior**: Approval-path coverage now verifies first-run `app-factory` tasks move to `PENDING_APPROVAL`, while retry tasks and lower-risk tasks run normally.
- **Better load-safety confidence**: Resource checks are now validated with mocked `/proc` data, including safe fallback behavior if system metrics cannot be parsed.
- **Release-ready build validation**: The scheduler package is now verified with passing tests plus a successful TypeScript build that generates `scripts/scheduler/dist/index.js`.
- **New executable TypeScript scheduler wrapper**: `scripts/scheduler-new.sh` now launches the compiled scheduler and has been smoke-tested for DB connectivity, clean exit/logging, and no task-state corruption.

## Task 74 Update: What's New for You
Task 74 completes the scheduler cutover, making the TypeScript runtime the production path while preserving safe operations.

### 🆕 What's New
- **TypeScript scheduler is now the live production runtime**: `scripts/scheduler.sh` is now a thin wrapper that runs the compiled TypeScript scheduler (`scripts/scheduler/dist/index.js`).
- **Legacy Bash scheduler is formally deprecated and archived**: The old 652-line Bash implementation was moved to `scripts/scheduler.sh.bak` as a rollback/reference artifact.
- **Clearer fail-fast runtime checks**: The scheduler wrapper now validates `node` and the compiled runtime artifact before execution, with explicit rebuild guidance when missing.
- **Better visibility during overlapping runs**: Lock contention now writes a clear `[LOCK] Scheduler already running (PID: ...)` message to `factory.log` instead of exiting silently.
- **Cutover was validated end-to-end**: Cron path compatibility was preserved, one live scheduler cycle exited cleanly, and SQLite integrity checks stayed healthy.

---
*Created and maintained by AI agents.*
