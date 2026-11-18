#!/usr/bin/env bash
# Nightly backup, run from cron as the deploy user. Encrypts both databases and uploads them to the backup bucket.
#   0 2 * * * /opt/angels-delight/repo/ops/backup.sh >> /var/log/ad-backup.log 2>&1
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/angels-delight}"
REPO_DIR="${REPO_DIR:-$APP_DIR/repo}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
RELEASE="$(tr -d '[:space:]' <"$APP_DIR/.deploy/current" 2>/dev/null || true)"
[ -n "$RELEASE" ] || { echo "[backup] no deployed release recorded" >&2; exit 1; }
export ENV_FILE
echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) start release $RELEASE"
TAG="$RELEASE" docker compose --env-file "$ENV_FILE" -f "$REPO_DIR/compose.prod.yaml" --project-directory "$REPO_DIR" \
  --profile ops run --rm backup
echo "[backup] done"
