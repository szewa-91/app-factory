# factory-dashboard

Operational dashboard for App Factory projects/tasks backed by `../../factory.db`.

## Features
- **Kanban board** for task workflow (`CREATED` → `READY` → `IN_PROGRESS` → `AUDITING` → `DONE`/`FAILED`)
- **Applications table** with inline domain editing and deploy buttons
- **Git history** display (recent commits per app)
- **Log viewer** with live polling and task-specific filtering
- **Task detail editor** (priority, audit notes, delete)

## Domain Management
Changing a project's domain via the UI automatically updates:
- `docker-compose.yml` (Traefik Host label)
- `verify.sh` (PUBLIC_URL variable)
- `CLAUDE.md` (Domain field)

Deploy button triggers `docker compose up -d --build` to rebuild and recreate the container with new config.

## Required Environment
- `ADMIN_PASSWORD`: mandatory login credential (no fallback).
- `DASHBOARD_SESSION_SECRET`: mandatory session signing secret, minimum 32 characters.
- `DATABASE_URL`: Prisma SQLite connection string (defaults via compose to `file:/app/factory.db`).

## Docker Requirements
- **Docker socket mount** (`/var/run/docker.sock`) for deploy functionality
- **docker.io** + **docker-compose v2 plugin** installed in container for `docker compose` CLI
- User group permissions for docker socket access (container adds user to docker group GID)

## Local Commands
```bash
npm run lint
./deploy.sh
./verify.sh
```

## Auth Model
- `POST /api/login` validates `ADMIN_PASSWORD` and issues an HMAC-signed `dashboard-session` cookie.
- Middleware verifies signature + expiry on every protected route.
- `POST /api/logout` clears the session cookie.
