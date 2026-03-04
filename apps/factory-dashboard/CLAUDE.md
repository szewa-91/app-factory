# Project Mandates: factory-dashboard

This project is managed by the App Factory. All autonomous agents MUST adhere to these rules:

## 🚀 Deployment Mandate
- **CRITICAL**: After any code modification, you MUST execute `./deploy.sh` to apply changes to the production container.
- Verification: Always check the logs or use `curl` to verify the deployment was successful.

## 🗄️ Database
- Shared database is located at `../../factory.db`.
- Prisma schema should reflect this relative path.

## 🔐 Auth Configuration
- `ADMIN_PASSWORD` is required for login. Do not introduce hardcoded/default fallback credentials.
- `DASHBOARD_SESSION_SECRET` is required for signed session cookies and must be at least 32 characters.

## 🐳 Docker Integration
- **Docker socket mounted** at `/var/run/docker.sock` for deploy functionality.
- **docker.io + docker-compose v2** installed in Dockerfile for `docker compose` CLI access.
- Container user added to docker group (GID from socket) to avoid permission issues.
- Deploy endpoint executes `docker compose up -d --build` in target app directories.

## 📝 Auto-Update on Domain Change
When domain is updated via `PATCH /api/projects/:name`:
- `docker-compose.yml` Traefik Host label gets updated
- `verify.sh` PUBLIC_URL variable gets updated
- `CLAUDE.md` Domain field gets updated
- Changes are applied when Deploy button is clicked

## 🤖 Headless Context
- You are running in a headless environment (`APP_FACTORY_HEADLESS=true`).
- Summarize your work in `TASK_SUMMARY.md` before exiting.
