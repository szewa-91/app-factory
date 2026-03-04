#!/usr/bin/env bash
# backup.sh — Nightly backup of factory.db and apps/ directory.
# Runs via cron at 3 AM: 0 3 * * * /home/szewa/app-factory/scripts/backup.sh
set -euo pipefail

WORKSPACE_DIR="/home/szewa/app-factory"
BACKUP_DIR="$WORKSPACE_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="factory_backup_${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="$BACKUP_DIR/$ARCHIVE_NAME"
RETAIN_DAYS=14

log() {
    echo "[backup.sh] $(date -u +"%Y-%m-%dT%H:%M:%SZ") $*"
}

log "Starting backup — $ARCHIVE_NAME"

mkdir -p "$BACKUP_DIR"

# Restrict archive permissions: umask 077 ensures the .tar.gz is created as mode 600
umask 077

# Create archive of factory.db and apps/ (excluding node_modules and .git internals)
# Excludes use relative paths matching archive members (tar -C strips the workspace prefix)
tar -czf "$ARCHIVE_PATH" \
    --exclude='apps/*/node_modules' \
    --exclude='apps/*/.next' \
    --exclude='apps/*/.git/objects/pack' \
    -C "$WORKSPACE_DIR" \
    factory.db \
    apps/

# Harden permissions in case umask was overridden by the calling environment
chmod 600 "$ARCHIVE_PATH"

ARCHIVE_SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
log "Archive created: $ARCHIVE_PATH ($ARCHIVE_SIZE)"

# Prune backups older than RETAIN_DAYS
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -name "factory_backup_*.tar.gz" \
    -mtime "+${RETAIN_DAYS}" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    log "Pruned $DELETED backup(s) older than ${RETAIN_DAYS} days"
fi

log "Backup complete."
