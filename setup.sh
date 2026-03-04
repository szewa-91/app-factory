#!/bin/bash

# App Factory Setup Script
# Prerequisites check, dependency installation, cron configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FACTORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$FACTORY_ROOT/apps/factory-dashboard/.env"
CRON_SCHEDULE="*/5 * * * *"
CRON_COMMENT="App Factory Scheduler"

# Parse command line arguments early
DOMAIN=""
PASSWORD=""
SETUP_TRAEFIK=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        --setup-traefik)
            SETUP_TRAEFIK="yes"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

echo -e "${BLUE}🏭 App Factory Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# STEP 1: Prerequisites Check
# ============================================================================

echo -e "${YELLOW}[1/5]${NC} Checking prerequisites..."
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    echo "  Install Docker: https://docs.docker.com/install"
    exit 1
fi
echo -e "${GREEN}✓ Docker${NC} $(docker --version)"

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose v2 not found${NC}"
    echo "  Install Docker Compose v2: https://docs.docker.com/compose/install"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose${NC} $(docker compose version --short)"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "  Install Node.js 18+: https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v)
if [[ ! $NODE_VERSION =~ v1[89]|v2[0-9] ]]; then
    echo -e "${RED}✗ Node.js 18+ required, found $NODE_VERSION${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js${NC} $NODE_VERSION"

# Check Docker socket
if [ ! -S /var/run/docker.sock ]; then
    echo -e "${RED}✗ Docker socket not accessible at /var/run/docker.sock${NC}"
    echo "  Ensure docker daemon is running and you have access"
    exit 1
fi
echo -e "${GREEN}✓ Docker socket${NC} accessible"

# Check disk space
AVAILABLE_GB=$(df "$FACTORY_ROOT" | tail -1 | awk '{print int($4/1024/1024)}')
if [ "$AVAILABLE_GB" -lt 10 ]; then
    echo -e "${YELLOW}⚠ Only ${AVAILABLE_GB}GB disk space available (10GB recommended)${NC}"
else
    echo -e "${GREEN}✓ Disk space${NC} ${AVAILABLE_GB}GB available"
fi

echo ""

# ============================================================================
# STEP 1.5: Check Traefik & coolify Network
# ============================================================================

echo -e "${YELLOW}[1.5/6]${NC} Checking Traefik setup..."
echo ""

COOLIFY_NETWORK=$(docker network ls --filter name=^coolify$ --quiet 2>/dev/null || echo "")
# Check for reverse proxy by looking for common containers (traefik, proxy, coolify-proxy)
TRAEFIK_RUNNING=$(docker ps --filter name=traefik --quiet 2>/dev/null | head -1)
[ -z "$TRAEFIK_RUNNING" ] && TRAEFIK_RUNNING=$(docker ps --filter name=proxy --quiet 2>/dev/null | head -1)
[ -z "$TRAEFIK_RUNNING" ] && TRAEFIK_RUNNING=$(docker ps --filter name=coolify-proxy --quiet 2>/dev/null | head -1)
[ -z "$TRAEFIK_RUNNING" ] && TRAEFIK_RUNNING=$(docker ps --filter "label=app.coolify.managed=true" --quiet 2>/dev/null | head -1)

if [ -z "$COOLIFY_NETWORK" ] || [ -z "$TRAEFIK_RUNNING" ]; then
    echo -e "${YELLOW}⚠ Traefik or 'coolify' network not found${NC}"
    echo ""

    if [ -z "$SETUP_TRAEFIK" ]; then
        echo "Would you like to set up Traefik now? (y/n)"
        read -p "> " SETUP_TRAEFIK
    fi

    if [[ "$SETUP_TRAEFIK" =~ ^[yY]$ ]] || [ "$SETUP_TRAEFIK" = "yes" ]; then
        echo ""
        echo "Setting up Traefik..."

        # Create traefik docker-compose file
        mkdir -p "$FACTORY_ROOT/infra"
        cat > "$FACTORY_ROOT/infra/docker-compose.traefik.yml" << 'EOF'
version: '3.8'

services:
  traefik:
    image: traefik:latest
    container_name: traefik
    command:
      - "--api.dashboard=true"
      - "--api.insecure=true"
      - "--entrypoints.http.address=:80"
      - "--entrypoints.https.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=http"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./acme.json:/acme.json
    networks:
      - coolify
    environment:
      - TRAEFIK_DASHBOARD=true

networks:
  coolify:
    driver: bridge
EOF

        # Create coolify network if needed
        if [ -z "$COOLIFY_NETWORK" ]; then
            docker network create coolify 2>/dev/null || true
            echo -e "${GREEN}✓ Created 'coolify' network${NC}"
        fi

        # Start Traefik
        touch "$FACTORY_ROOT/infra/acme.json"
        chmod 600 "$FACTORY_ROOT/infra/acme.json"
        docker compose -f "$FACTORY_ROOT/infra/docker-compose.traefik.yml" up -d

        echo -e "${GREEN}✓ Traefik started${NC}"
        echo "  Dashboard: http://localhost:8080"
        echo "  Config file: $FACTORY_ROOT/infra/docker-compose.traefik.yml"
    else
        echo -e "${YELLOW}⚠ Traefik not set up${NC}"
        echo "You'll need to configure it manually before deploying apps."
        echo "For instructions, see: https://docs.traefik.io/"
    fi
else
    echo -e "${GREEN}✓ Traefik${NC} running"
    echo -e "${GREEN}✓ Network 'coolify'${NC} exists"
fi

echo ""

# ============================================================================
# STEP 2: Environment Configuration
# ============================================================================

echo -e "${YELLOW}[2/6]${NC} Setting up environment..."
echo ""

# Prompt for domain if not provided
if [ -z "$DOMAIN" ]; then
    echo "Enter dashboard domain (e.g., dashboard.example.com):"
    read -p "> " DOMAIN
fi

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}✗ Domain is required${NC}"
    exit 1
fi

# Prompt for password if not provided
if [ -z "$PASSWORD" ]; then
    echo ""
    echo "Enter admin password (will be generated if empty):"
    read -s -p "> " PASSWORD
    echo ""
fi

if [ -z "$PASSWORD" ]; then
    PASSWORD=$(openssl rand -hex 16)
    echo -e "Generated password: ${YELLOW}$PASSWORD${NC}"
fi

# Generate session secret
SESSION_SECRET=$(openssl rand -hex 32)

# Create .env file
mkdir -p "$(dirname "$ENV_FILE")"
cat > "$ENV_FILE" << EOF
# Database
DATABASE_URL="file:../../factory.db"

# Authentication
ADMIN_PASSWORD="$PASSWORD"
DASHBOARD_SESSION_SECRET="$SESSION_SECRET"

# Server
NODE_ENV=production
NEXTAUTH_URL="https://$DOMAIN"
EOF

echo -e "${GREEN}✓ Created${NC} $ENV_FILE"
echo ""

# ============================================================================
# STEP 3: Install Dependencies
# ============================================================================

echo -e "${YELLOW}[3/6]${NC} Installing dependencies..."
echo ""

# Scheduler
echo "Installing scheduler dependencies..."
cd "$FACTORY_ROOT/scripts/scheduler"
npm install --silent
npm run build --silent
cd "$FACTORY_ROOT"
echo -e "${GREEN}✓ Scheduler${NC} dependencies installed and built"

# Dashboard
echo "Installing dashboard dependencies..."
cd "$FACTORY_ROOT/apps/factory-dashboard"
npm install --silent > /dev/null 2>&1
npx prisma generate > /dev/null 2>&1
cd "$FACTORY_ROOT"
echo -e "${GREEN}✓ Dashboard${NC} dependencies installed"

echo ""

# ============================================================================
# STEP 4: Setup Scheduler Cron Job
# ============================================================================

echo -e "${YELLOW}[4/6]${NC} Setting up scheduler cron job..."
echo ""

CRON_CMD="$CRON_SCHEDULE /bin/bash $FACTORY_ROOT/scripts/scheduler.sh >> $FACTORY_ROOT/factory.log 2>&1"
CRON_GREP="$FACTORY_ROOT/scripts/scheduler.sh"

# Check if cron already exists
if crontab -l 2>/dev/null | grep -q "$CRON_GREP"; then
    echo -e "${YELLOW}⚠ Cron job already exists${NC}"
    echo "To update it, run: crontab -e"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "# $CRON_COMMENT"; echo "$CRON_CMD") | crontab -
    echo -e "${GREEN}✓ Cron job added${NC}"
    echo "  Schedule: $CRON_SCHEDULE (every 5 minutes)"
    echo "  Command: $FACTORY_ROOT/scripts/scheduler.sh"
    echo "  Log: $FACTORY_ROOT/factory.log"
fi

echo ""

# ============================================================================
# STEP 5: Summary & Next Steps
# ============================================================================

echo -e "${YELLOW}[6/6]${NC} Setup complete! 🎉"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. Deploy the dashboard:"
echo -e "   ${YELLOW}cd $FACTORY_ROOT/apps/factory-dashboard${NC}"
echo -e "   ${YELLOW}./deploy.sh${NC}"
echo ""
echo "2. Access the dashboard:"
echo -e "   ${YELLOW}https://$DOMAIN${NC}"
echo -e "   Password: ${YELLOW}$PASSWORD${NC}"
echo ""
echo "3. Create your first app:"
echo -e "   ${YELLOW}$FACTORY_ROOT/scripts/bootstrap.sh my-app my-app.example.com${NC}"
echo ""
echo "4. Monitor logs:"
echo -e "   ${YELLOW}tail -f $FACTORY_ROOT/factory.log${NC}"
echo ""

echo -e "${BLUE}Cron job:${NC}"
if crontab -l 2>/dev/null | grep -q "$CRON_GREP"; then
    echo -e "  ${GREEN}✓ Running${NC} (every 5 minutes)"
    echo "  To view: ${YELLOW}crontab -l${NC}"
    echo "  To edit: ${YELLOW}crontab -e${NC}"
else
    echo -e "  ${RED}✗ Not configured${NC}"
fi

echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  README.md - Setup & workflow"
echo "  CLAUDE.md - Agent instructions"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Setup finished! Happy building! 🚀${NC}"
