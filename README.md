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

**Required:**
- **VPS** with Linux (Ubuntu 20.04+, Debian 11+)
- **Docker** + Docker Compose v2
- **Node.js 18+** (for scheduler)
- **At least one AI Agent** (choose one or more):
  - **Claude** (Anthropic) - `ANTHROPIC_API_KEY`
  - **GPT/Codex** (OpenAI) - `OPENAI_API_KEY`
  - **Gemini** (Google) - `GOOGLE_API_KEY`

**Optional (for production):**
- **Traefik** (reverse proxy with Let's Encrypt HTTPS)
- **Domains** with DNS pointed to your VPS

### Quick Setup (Automated)

```bash
git clone https://github.com/yourusername/app-factory.git
cd app-factory

# Run setup (interactive mode)
./setup.sh
```

**What `setup.sh` does:**
- ✓ Verifies Docker, Docker Compose v2, Node.js 18+
- ✓ Checks Docker socket access
- ✓ Generates `.env` with secure secrets
- ✓ Installs scheduler and dashboard dependencies
- ✓ Configures scheduler cron job (every 5 minutes)
- ✓ Optionally sets up Traefik for production

#### Deployment Modes

**Development (localhost-only)**
```bash
./setup.sh  # Skip Traefik setup when prompted
```
- Apps accessible on `localhost:3000`, `localhost:3001`, etc.
- No HTTPS, no domains needed
- Perfect for testing & development

**Production (with Traefik)**
```bash
./setup.sh --domain dashboard.example.com --setup-traefik
```
- Apps accessible via single domain with HTTPS
- Let's Encrypt SSL certificates
- Virtual host routing
- Requires DNS pointing to your VPS

#### Configure AI Agents

After running setup, configure your API keys in `apps/factory-dashboard/.env`:

```bash
# Add at least ONE of these:

# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI GPT/Codex
OPENAI_API_KEY="sk-..."

# Google Gemini
GOOGLE_API_KEY="..."
```

**Note:** If using authenticated access (OAuth) instead of API keys, you can skip this step if you're running the scheduler on a machine with authenticated sessions.

#### After Setup

```bash
# 1. Deploy the dashboard
cd apps/factory-dashboard
./deploy.sh

# 2. Access dashboard
#    Development: http://localhost:3000 (password from setup)
#    Production:  https://dashboard.example.com (password from setup)

# 3. Create your first app
./scripts/bootstrap.sh my-app my-app.example.com  # or just "my-app" for localhost mode
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
