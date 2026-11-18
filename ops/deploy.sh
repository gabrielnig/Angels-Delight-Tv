#!/usr/bin/env bash
# Deploy a release on the VPS: check out the ref, pull images, migrate, restart, wait for health, roll back on failure.
#
#   ops/deploy.sh <tag>        deploy the release built for this git sha or tag
#   ops/deploy.sh --rollback   redeploy the previous release (no migration is run)
#
# Environment (all optional):
#   APP_DIR          state and env file location (default /opt/angels-delight)
#   REPO_DIR         git clone holding compose.prod.yaml (default $APP_DIR/repo)
#   ENV_FILE         production env file (default $APP_DIR/.env)
#   SKIP_GIT         set to 1 when REPO_DIR is not a git clone
#   HEALTH_TIMEOUT   seconds to wait for the web container to report healthy (default 120)
#   HEALTH_INTERVAL  seconds between health probes (default 3)
#
# Migrations only move forward. Keep them backward compatible so that a rollback to the previous image still works.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/angels-delight}"
REPO_DIR="${REPO_DIR:-$APP_DIR/repo}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
STATE_DIR="$APP_DIR/.deploy"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-3}"
export ENV_FILE

usage() {
  echo "Usage: ops/deploy.sh <tag> | --rollback" >&2
  exit 2
}

say() { echo "[deploy] $*"; }
fail() {
  echo "[deploy] $*" >&2
  exit 1
}

[ $# -eq 1 ] || usage
ARG="$1"
[ -n "$ARG" ] || usage

mkdir -p "$STATE_DIR"

read_state() {
  if [ -f "$STATE_DIR/$1" ]; then tr -d '[:space:]' <"$STATE_DIR/$1"; fi
}

compose() {
  TAG="$RELEASE" docker compose --env-file "$ENV_FILE" -f "$REPO_DIR/compose.prod.yaml" --project-directory "$REPO_DIR" "$@"
}

checkout() {
  [ "${SKIP_GIT:-}" = 1 ] && return 0
  git -C "$REPO_DIR" fetch --tags --quiet origin
  git -C "$REPO_DIR" checkout --quiet --detach "$1"
}

wait_healthy() {
  local attempts=$((HEALTH_TIMEOUT / HEALTH_INTERVAL))
  [ "$attempts" -ge 1 ] || attempts=1
  local i
  for ((i = 1; i <= attempts; i++)); do
    if compose exec -T web node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

start_release() {
  compose up -d --remove-orphans
}

CURRENT="$(read_state current)"
PREVIOUS="$(read_state previous)"

record() {
  # $1 is the release that is now live
  if [ -n "$CURRENT" ] && [ "$CURRENT" != "$1" ]; then
    echo "$CURRENT" >"$STATE_DIR/previous"
  fi
  echo "$1" >"$STATE_DIR/current"
}

if [ "$ARG" = "--rollback" ]; then
  [ -n "$PREVIOUS" ] || fail "No previous release recorded, nothing to roll back to."
  RELEASE="$PREVIOUS"
  say "Rolling back to $RELEASE (no migration is run)"
  checkout "$RELEASE"
  compose pull --quiet || fail "Pull failed for $RELEASE"
  start_release
  wait_healthy || fail "Release $RELEASE did not become healthy"
  echo "$CURRENT" >"$STATE_DIR/previous"
  echo "$RELEASE" >"$STATE_DIR/current"
  say "Rolled back to $RELEASE"
  exit 0
fi

RELEASE="$ARG"
say "Deploying $RELEASE (current: ${CURRENT:-none})"

checkout "$RELEASE" || fail "Could not check out $RELEASE"
compose pull --quiet || fail "Pull failed for $RELEASE, nothing was changed"

compose up -d --wait postgres || fail "Postgres did not become healthy, nothing was changed"
if ! compose --profile ops run --rm migrate; then
  fail "Migration failed, the running release was not touched"
fi

start_release
if wait_healthy; then
  record "$RELEASE"
  say "Release $RELEASE is healthy"
  exit 0
fi

echo "[deploy] Release $RELEASE did not become healthy within ${HEALTH_TIMEOUT}s" >&2
if [ -z "$CURRENT" ]; then
  fail "No previous release to roll back to. Inspect with: docker compose logs web"
fi
say "Rolling back to $CURRENT"
RELEASE="$CURRENT"
checkout "$RELEASE" || true
start_release
wait_healthy || say "Warning: $RELEASE is also not healthy, check the logs"
exit 1
