# 🏭 App Factory

> **Autonomous system for bootstrapping, building, auditing, and deploying Next.js applications on VPS using AI agents.**

App Factory automates the entire journey from idea to production: PRD → SPECS → tasks → AI-driven implementation → auditing → deployment.

---

## 🎯 How It Works

### 1. Define Your Idea
```
PRD.md (Product Requirements)
  ↓ (AI generates)
SPECS.md (Technical Specifications)
```

### 2. Bootstrap the App
```bash
./scripts/bootstrap.sh my-app example.com
```

### 3. Scheduler Orchestrates Work
```
TRIAGE (difficulty assessment + agent assignment)
  ↓
READY (awaiting execution)
  ↓
IN_PROGRESS (AI agent implements)
  ↓
AUDITING (security & quality review)
  ↓
DONE ✅
```

### 4. Monitor via Dashboard
Real-time Kanban board, logs, deployment controls.

---

## 📦 Installation

### Prerequisites
- **VPS** with Linux (Ubuntu 20.04+, Debian 11+)
- **Docker** + Docker Compose v2
- **Node.js 18+** (for scheduler)
- **Traefik** on `coolify` network
- **Domains** with DNS pointed to your VPS

### Step 1: Clone & Install

```bash
git clone https://github.com/yourusername/app-factory.git
cd app-factory

# Scheduler
cd scripts/scheduler
npm install && npm run build
cd ../..

# Dashboard
cd apps/factory-dashboard
npm install
cd ../..
```

### Step 2: Environment Setup

Create `.env` in `apps/factory-dashboard/`:

```bash
DATABASE_URL="file:../../factory.db"
ADMIN_PASSWORD="your-secure-password"
DASHBOARD_SESSION_SECRET="$(openssl rand -hex 32)"
NODE_ENV=production
```

### Step 3: Database & Prisma

```bash
cd apps/factory-dashboard
npx prisma generate
cd ../..
```

### Step 4: Deploy Dashboard (Following Bootstrap Process)

Run the bootstrap to properly set up the dashboard:

```bash
./scripts/bootstrap.sh factory-dashboard dashboard.your-domain.com
```

This will:
- Create proper Docker configuration
- Set up Traefik labels for HTTPS
- Register in `factory.db`
- Schedule deployment tasks

**Manual alternative** (if needed):

```bash
cd apps/factory-dashboard
npm run build
docker build -t factory-dashboard:latest .
cd ../..

# Update docker-compose.yml in apps/factory-dashboard with:
# - DATABASE_URL environment variable
# - Traefik labels (Host rule, HTTPS, TLS resolver)
# - coolify network
# - Volume mounts for factory.db

docker compose -f apps/factory-dashboard/docker-compose.yml up -d
```

### Step 5: Scheduler in Cron

Add to crontab:
```bash
*/5 * * * * /path/to/app-factory/scripts/scheduler.sh >> /path/to/app-factory/factory.log 2>&1
```

Or use systemd timer for better reliability.

---

## 🚀 Quick Start: Create Your First App

```bash
# Bootstrap
./scripts/bootstrap.sh social-dashboard social.example.com

# Scheduler automatically:
# - Generates SPECS.md (architecture, database schema, API endpoints)
# - Decomposes work into tasks
# - Starts implementation via AI agents
```

Monitor in the dashboard at `https://dashboard.your-domain.com`:
- Login with any username
- Password: value from `ADMIN_PASSWORD`

---

## 🤖 Agent Role Assignment

Tasks are automatically routed to specialized agents:

- **ui-developer**: UI/component tasks (Claude Sonnet → Gemini Flash)
- **architect**: Complex architectural decisions (high priority, >800 chars, database/API design)
- **developer**: General implementation tasks (default)

---

## 📊 Dashboard Features

- **Kanban Board**: TRIAGE → READY → IN_PROGRESS → AUDITING → DONE/FAILED
- **Projects Table**: Edit domains, deploy buttons
- **Task Details**: Priority, dependencies, audit notes, assigned agent
- **Live Logs**: Stream scheduler and app logs
- **Git History**: Recent commits per project

---

## 🗂️ Project Structure

```
app-factory/
├── factory.db              # Central task & project database
├── factory.log             # Scheduler logs
├── CLAUDE.md               # Agent instructions
│
├── scripts/
│   ├── bootstrap.sh        # Create new app
│   ├── scheduler.sh        # Cron entry point
│   └── scheduler/          # TypeScript scheduler (src/ + dist/)
│
├── apps/
│   ├── factory-dashboard/  # Dashboard UI (Next.js)
│   └── my-app/             # Generated applications
│
└── lessons/                # Lessons learned per task
```

---

## 🔐 Security

- **Sessions**: Signed cookies, no localStorage
- **HTTPS**: Enforced via Traefik with Let's Encrypt
- **Database**: SQLite, mounted in containers
- **Docker**: Each app in isolated container on `coolify` network
- **Agent Execution**: Headless, context persisted for retries

---

## 🛠️ Troubleshooting

### Scheduler not running
```bash
systemctl status app-factory.timer
journalctl -u app-factory -f
/path/to/app-factory/scripts/scheduler.sh  # Manual run
```

### Dashboard unavailable
```bash
docker ps | grep factory-dashboard
docker logs app-factory-factory-dashboard
```

### App fails to deploy
```bash
cat factory.log | grep "Task <ID>"
cd apps/my-app && ./verify.sh
docker logs app-my-app
```

---

## 📚 Documentation

- [`CLAUDE.md`](CLAUDE.md) - Agent instructions
- [`vision/VISION.md`](vision/VISION.md) - Architecture principles
- `apps/<name>/PRD.md` - Product requirements
- `apps/<name>/SPECS.md` - Technical specifications

---

## 📄 License

MIT

---

**Built with ❤️ for autonomous app development.**
