#!/bin/bash
# App Factory Verification Script - factory-dashboard
# This script is called by the scheduler before marking a task as DONE.

echo "🔍 Starting verification for factory-dashboard..."

# 1. Check if the Docker container is running
echo "🐳 Checking Docker container status..."
CONTAINER_STATUS=$(docker compose ps --format json | grep '"Service":"app"' | grep -o '"State":"[^"]*"' | cut -d'"' -f4)

if [ "$CONTAINER_STATUS" != "running" ]; then
    echo "❌ ERROR: Container 'app' is NOT running (State: $CONTAINER_STATUS)"
    docker compose logs --tail 20 app
    exit 1
fi
echo "✅ Container is running."

# 2. Check if the application is responsive on internal port
echo "📡 Checking application responsiveness (internal)..."
# We try up to 5 times with a small delay to allow for startup
MAX_RETRIES=5
COUNT=0
SUCCESS=false

while [ $COUNT -lt $MAX_RETRIES ]; do
    if docker compose exec -T app curl -s -f http://localhost:3001 > /dev/null; then
        SUCCESS=true
        break
    fi
    echo "⏳ Waiting for app to respond (Attempt $((COUNT+1))/$MAX_RETRIES)..."
    sleep 2
    COUNT=$((COUNT+1))
done

if [ "$SUCCESS" = false ]; then
    echo "❌ ERROR: Application is not responding on http://localhost:3001"
    docker compose logs --tail 50 app
    exit 1
fi
echo "✅ Application is responsive."

# 3. Custom Functional Tests (Optional)
# If a tests directory exists, run npm test
if [ -f "package.json" ] && grep -q '"test":' package.json; then
    echo "🧪 Running npm tests..."
    if ! docker compose exec -T app npm test; then
        echo "❌ ERROR: npm tests failed."
        exit 1
    fi
    echo "✅ Tests passed."
fi

echo "🎉 All verifications passed for factory-dashboard!"
exit 0
