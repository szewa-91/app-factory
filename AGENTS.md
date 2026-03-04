# App Factory - Gemini Workspace Guide

Welcome to the App Factory. This is an autonomous environment where AI agents bootstrap, develop, and deploy applications based on user ideas.

## 🏗️ Project Architecture
- **`apps/`**: Individual application repositories. Each should have its own `.git`.
- **`templates/default/`**: Next.js + Docker + SQLite + Coolify deployment templates.
- **`scripts/`**: 
  - `bootstrap.sh`: Initializes a new app with hardened defaults (strict shell mode, validated input, Vitest/Playwright, and resilient deployment templates).
  - `scheduler.sh`: Headless task runner with self-healing, resource monitoring, and Git safety.
- **`factory.db`**: SQLite database for central management (projects & tasks).
- **`factory.log`**: Central execution log.

## 🚀 Workflow: Idea to Deployment
1. **Idea Processing**: Generate a **PRD.md** focused on MVP market fit (prefer root-level `PRD.md`).
2. **Technical Design Phase**: Before any coding, an agent MUST generate **SPECS.md**. This includes database schema, API endpoints, and a detailed task decomposition.
3. **Bootstrapping**: Run `./scripts/bootstrap.sh <app-name> <domain>`.
4. **Decomposition**: Break the SPECS into atomic tasks in `factory.db`.
5. **Activation**: Move tasks to `READY`. Use `depends_on` to sequence them.
6. **Headless Execution & Audit**: 
   - **Phase A (Developer)**: Implements the feature, passes tests, and creates `TASK_SUMMARY.md`.
   - **Phase B (Auditor)**: A second agent pass (or same agent with 'Auditor' persona) reviews the changes, logs, and `PLAN.md`. It checks for technical debt, security issues, and 'Anti-Placeholder' compliance.
7. **Health Check & E2E**: Scheduler calls project-level `./verify.sh` (if present), which handles internal health, unit tests, and Playwright E2E checks with public URL readiness retries.
8. **Launch Prep**: Upon successful deployment, the agent generates a **LAUNCH.md** for marketing/user guidance.

## 🛠️ Task Management (factory.db)
- `CREATED`: Task defined.
- `READY`: Actionable and waiting.
- `PENDING_APPROVAL`: High-risk or infra tasks awaiting manual confirmation.
- `APPROVED`: Explicitly approved high-risk tasks.
- `IN_PROGRESS`: Handled by Developer agent.
- `AUDITING`: Handled by Auditor agent for quality control.
- `DONE`: Completed, audited, and health-check verified.
- `FAILED`: Failed execution, audit, or health-check after 3 retries.

## 📜 Infrastructure Standards
- **Network**: `coolify` (external).
- **Traefik**: Entrypoint `https`, certresolver `letsencrypt`.
- **Next.js**: `standalone` mode.
- **Database**: SQLite (mounted from host for persistence).
- **Ports**: Containers listen internally on port `3000`; exposure is domain-based via Traefik (`coolify` network).

## 🤖 Headless Agent Infrastructure (Safety & Tags)
To distinguish autonomous agents from interactive sessions and ensure resilient execution:
1. **Mandatory Planning & Checklist**: At the start of every task, agents MUST create a **PLAN.md** file in the root of the project. This file MUST be a prioritized checklist updated in real-time.
2. **Vision Alignment**: Before any architectural change, agents MUST read `vision/VISION.md` to ensure they do not violate the core principles of the factory.
3. **Anti-Placeholder Policy**: Agents are strictly forbidden from leaving placeholder code. Every task MUST result in fully functional, production-ready code.
4. **Atomic Git Commits**: After successfully verifying code changes, agents MUST stage and commit their work to the local repository (`git add . && git commit -m "Task [ID]: Title"`).
5. **Self-Healing System**: The scheduler automatically captures diagnostic context (`PREVIOUS_FAILURE.log`) on task failure. Agents MUST analyze this context on retries to identify root causes.
6. **Git Safety Net**: For `app-factory` infra changes, the scheduler records the pre-task SHA and performs an automatic `git reset --hard` if verification or audit fails.
7. **Resource Monitoring**: The scheduler checks VPS RAM and CPU. Task execution is skipped if usage > 80% to ensure stability.
8. **Documentation Sync**: If a task alters system logic, the agent MUST update both `README.md` and `GEMINI.md` to reflect the new state.
9. **Verification Baseline**: New apps must keep the default verification flow (`./verify.sh`) as the single app-level check entrypoint.
10. **PRD/SPECS Discipline**: Every app must maintain `PRD.md` and `SPECS.md`; if PRD is missing at bootstrap, agents must create one before decomposition.
11. **Mandatory Deployment**: After code changes, the agent MUST execute `./deploy.sh` in the project directory.
12. **The Auditor Persona**: When a task enters `AUDITING`, the agent MUST find technical debt, security issues, and policy violations. It writes results to `AUDIT_RESULT.md`.
13. **Lessons Learned**: After every task, the agent MUST write a concise technical insight to a new file in `/home/szewa/app-factory/lessons/<task_id>_<timestamp>.md`.
14. **Execution Limits**: 30-minute timeout per task. Active task PID is tracked in `agent.pid`.

### Safety Commands:
- **Kill only factory agents**: `pkill -f "APP_FACTORY_HEADLESS=true"`
- **Monitor active agent**: `tail -f apps/<project>/agent.log`
- **Reset stale tasks**: `scheduler.sh` automatically resets `IN_PROGRESS` tasks if their PID is missing.
