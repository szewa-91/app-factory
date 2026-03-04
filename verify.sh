#!/bin/bash
# App Factory - Root Verification Script
# Verifies that the factory infrastructure is sound.

echo "🔍 Verifying App Factory infrastructure..."

# 1. Database Check
echo "🗄️ Checking factory.db..."
if [ ! -f "factory.db" ]; then
    echo "❌ ERROR: factory.db missing."
    exit 1
fi
if ! sqlite3 factory.db "SELECT COUNT(*) FROM tasks;" > /dev/null; then
    echo "❌ ERROR: factory.db is corrupted or unreadable."
    exit 1
fi
echo "✅ Database is healthy."

# 2. Scripts Check
echo "📜 Checking critical scripts..."
SCRIPTS=("scripts/bootstrap.sh" "scripts/scheduler.sh")
for script in "${SCRIPTS[@]}"; do
    if [ ! -x "$script" ]; then
        echo "❌ ERROR: $script is not executable or missing."
        exit 1
    fi
done
echo "✅ Scripts are executable."

# 3. Templates Check
echo "📋 Checking templates..."
TEMPLATES=(
    "templates/default/Dockerfile.template"
    "templates/default/.dockerignore.template"
    "templates/default/docker-compose.yml.template"
    "templates/default/deploy.sh.template"
    "templates/default/verify.sh.template"
)
for template in "${TEMPLATES[@]}"; do
    if [ ! -f "$template" ]; then
        echo "❌ ERROR: $template is missing."
        exit 1
    fi
done
echo "✅ All templates are present."

echo "🎉 Factory infrastructure verification passed!"
exit 0
