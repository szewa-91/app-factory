#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="/home/szewa/app-factory"
ENTRYPOINT="$WORKSPACE_DIR/scripts/scheduler/dist/index.js"

if ! command -v node >/dev/null 2>&1; then
    echo "[scheduler.sh] ERROR: 'node' is not available in PATH." >&2
    exit 127
fi

if [ ! -f "$ENTRYPOINT" ]; then
    echo "[scheduler.sh] ERROR: Missing scheduler runtime '$ENTRYPOINT'." >&2
    echo "[scheduler.sh] Rebuild with: npm -C $WORKSPACE_DIR/scripts/scheduler run build" >&2
    exit 1
fi

exec node "$ENTRYPOINT"
