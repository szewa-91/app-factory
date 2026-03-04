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

### Quick Setup (Automated)

```bash
git clone https://github.com/yourusername/app-factory.git
cd app-factory

# Run automated setup (checks prerequisites, installs dependencies, configures cron)
./setup.sh --domain dashboard.example.com --password your-secure-password
```

**What `setup.sh` does:**
- ✓ Verifies Docker, Docker Compose v2, Node.js 18+
- ✓ Checks Docker socket access
- ✓ Generates `.env` with secure secrets
- ✓ Installs scheduler and dashboard dependencies
- ✓ Configures scheduler cron job (every 5 minutes)
- ✓ Provides next steps

After setup completes:

```bash
# 1. Deploy the dashboard
cd apps/factory-dashboard
./deploy.sh

# 2. Access dashboard at https://dashboard.example.com
# 3. Create your first app
./scripts/bootstrap.sh my-app my-app.example.com
```

### Manual Setup (if needed)

Skip this if you used `setup.sh` above.

```bash
# Clone and navigate
git clone https://github.com/yourusername/app-factory.git
cd app-factory

# Install dependencies
cd scripts/scheduler && npm install && npm run build && cd ../..
cd apps/factory-dashboard && npm install && npx prisma generate && cd ../..

# Create .env
cat > apps/factory-dashboard/.env << EOF
DATABASE_URL="file:../../factory.db"
ADMIN_PASSWORD="your-secure-password"
DASHBOARD_SESSION_SECRET="$(openssl rand -hex 32)"
NODE_ENV=production
EOF

# Deploy dashboard
cd apps/factory-dashboard && ./deploy.sh && cd ../..

# Add scheduler to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /path/to/app-factory/scripts/scheduler.sh >> /path/to/app-factory/factory.log 2>&1") | crontab -
```

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
├── setup.sh                # Automated setup (prerequisites, deps, cron)
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
