#!/bin/bash
set -euo pipefail
# App Factory Deployment Script - factory-dashboard

echo "🚀 Starting deployment for factory-dashboard..."

if [ ! -f ".env" ]; then
    touch .env
fi

admin_password=$(grep -E '^ADMIN_PASSWORD=' .env | tail -n 1 | cut -d'=' -f2- | sed 's/^"//; s/"$//' || true)
if [ -z "${admin_password:-}" ]; then
    echo "❌ ERROR: ADMIN_PASSWORD must be set in .env"
    exit 1
fi

if [ "$admin_password" = "admin123" ]; then
    echo "⚠️ WARNING: ADMIN_PASSWORD is set to a weak value. Rotate it in .env."
fi

session_secret=$(grep -E '^DASHBOARD_SESSION_SECRET=' .env | tail -n 1 | cut -d'=' -f2- | sed 's/^"//; s/"$//' || true)
if [ -z "${session_secret:-}" ] || [ "${#session_secret}" -lt 32 ]; then
    new_secret=$(openssl rand -hex 32)
    if grep -qE '^DASHBOARD_SESSION_SECRET=' .env; then
        sed -i "s|^DASHBOARD_SESSION_SECRET=.*|DASHBOARD_SESSION_SECRET=\"$new_secret\"|" .env
    else
        echo "DASHBOARD_SESSION_SECRET=\"$new_secret\"" >> .env
    fi
    echo "🔐 Generated DASHBOARD_SESSION_SECRET in .env"
fi

# Ensure data directory exists for SQLite
mkdir -p data
chown -R 1000:1000 data

# Generate Prisma Client (if prisma directory exists)
if [ -d "prisma" ]; then
    echo "💎 Generating Prisma Client..."
    npx prisma generate
fi

# Rebuild and restart containers
echo "📦 Building and restarting Docker containers..."
APP_NAME=factory-dashboard DOMAIN=dashboard.marcinszewczyk.pl APP_PORT=3001 docker compose up -d --build

# Apply migrations if using Prisma
if [ -d "prisma" ]; then
    if [ -d "prisma/migrations" ] && find prisma/migrations -mindepth 1 -maxdepth 1 -type d | grep -q .; then
        echo "🗄️ Applying database migrations..."
        docker compose exec -T app npx prisma@5.22.0 migrate deploy
    else
        echo "ℹ️ No Prisma migrations detected. Skipping migrate deploy."
    fi
fi

echo "✅ Deployment complete! App is live at https://dashboard.marcinszewczyk.pl"
