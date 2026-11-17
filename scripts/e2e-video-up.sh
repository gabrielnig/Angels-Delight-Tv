#!/usr/bin/env bash
# Prepares the local stack for the video end to end run (docs/lanes/K2-video-integration.md):
# databases `ad_e2e` and `ad_e2e_keys` on the local Postgres, migrations, a fresh .env.e2e-video with throwaway
# secrets and the local storage driver, and the e2e admin and viewer accounts.
# Needs a running Postgres with a superuser reachable as `su postgres -c psql` (pg_ctlcluster 16 main start), and ffmpeg.
# Usage: scripts/e2e-video-up.sh [port]   (default 3111)
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${1:-3111}"
PW=dev
ENV_FILE=.env.e2e-video
STORE="$PWD/.e2e-storage"

psql_admin() { su postgres -c "psql -v ON_ERROR_STOP=1 -q $*"; }

# The roles come from packages/db/sql/roles.sql. Give them a throwaway password so TCP logins work.
su postgres -c "psql -v ON_ERROR_STOP=1 -q -f $PWD/packages/db/sql/roles.sql" >/dev/null
for role in ad_migrator ad_app ad_worker ad_keys_app ad_keys_shred ad_maintenance; do
  psql_admin "-c \"ALTER ROLE $role LOGIN PASSWORD '$PW'\"" >/dev/null
done
for db in ad_e2e ad_e2e_keys; do
  psql_admin "-c \"DROP DATABASE IF EXISTS $db WITH (FORCE)\"" >/dev/null
  psql_admin "-c \"CREATE DATABASE $db OWNER ad_migrator\"" >/dev/null
done

rm -rf "$STORE" /tmp/ad-e2e-work
mkdir -p "$STORE" /tmp/ad-e2e-work

key() { openssl rand -base64 32; }
HOST=localhost:5432
cat > "$ENV_FILE" <<ENV
NODE_ENV=development
APP_ORIGIN=http://localhost:$PORT
MEDIA_ORIGIN=http://localhost:$PORT/api/dev-media
COOKIE_PREFIX_SECURE=false
TRUSTED_PROXY_MODE=none
EDGE_TOKEN_MODE=off
DEV_SKIP_MFA=true
AUTH_FIXTURES=off
PLAYBACK_TRANSPORT=http
LOG_LEVEL=info

DATABASE_URL=postgres://ad_app:$PW@$HOST/ad_e2e
DATABASE_URL_WORKER=postgres://ad_worker:$PW@$HOST/ad_e2e
DATABASE_URL_MAINTENANCE=postgres://ad_maintenance:$PW@$HOST/ad_e2e
DATABASE_URL_MIGRATE=postgres://ad_migrator:$PW@$HOST/ad_e2e
KEYS_DATABASE_URL_MIGRATE=postgres://ad_migrator:$PW@$HOST/ad_e2e_keys
KEYS_DATABASE_URL=postgres://ad_keys_app:$PW@$HOST/ad_e2e_keys
KEYS_DATABASE_URL_SHRED=postgres://ad_keys_shred:$PW@$HOST/ad_e2e_keys

FIELD_KEK=$(key)
EMAIL_HASH_PEPPER=$(key)
HLS_KEK=$(key)
PLAYBACK_TOKEN_SECRET=$(key)
MEDIA_URL_SECRET=$(key)

STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=$STORE
BUCKET_ORIGINALS=ad-originals
BUCKET_MEDIA=ad-media

SMTP_URL=smtp://localhost:1025
EMAIL_FROM=no-reply@localhost
WHISPER_FAKE=true
FFMPEG_PRESET=veryfast
WORKER_SCRATCH_DIR=/tmp/ad-e2e-work
WORKER_SCRATCH_MIN_FREE_RATIO=0.05
UPLOAD_PART_BYTES=5242880
# The specs read tables the app roles cannot (row level security is forced), so they use a superuser url.
E2E_DATABASE_ADMIN_URL=${E2E_DATABASE_ADMIN_URL:-postgres://postgres:postgres@localhost:5432/ad_e2e}
ENV

set -a
# shellcheck disable=SC1090
. "./$ENV_FILE"
set +a

pnpm --filter @ad/db db:migrate
pnpm --filter @ad/web exec tsx e2e/support/seed.ts
echo "ready: web on port $PORT, env in $ENV_FILE"
