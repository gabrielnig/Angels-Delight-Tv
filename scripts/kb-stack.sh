#!/usr/bin/env bash
# The isolated demo stack for the admin knowledge base recorder (plan section 11, D-362).
#   scripts/kb-stack.sh env [port]      print the environment of the fixture stack (no database, throwaway keys)
#   scripts/kb-stack.sh fixture [port]  start the web app on the fixture data with the demo layer (dev server, foreground)
#   scripts/kb-stack.sh start [port]    the same for an app that is already built (next start), for CI: no compile pauses
#   scripts/kb-stack.sh real [port]     prepare databases ad_kb and ad_kb_keys on the local Postgres and write .env.kb-real
# The fixture stack serves the demo dataset (apps/web/src/lib/data/admin/kb-demo), a pinned server clock and the reset
# route the recorder calls between episodes. Never point this at real data: the recorder refuses any other origin.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-fixture}"
PORT="${2:-3141}"
DEMO_NOW="${KB_DEMO_NOW:-2026-03-10T09:00:00.000Z}"

fixture_env() {
  scripts/ci-fixture-env.sh "$PORT"
  # Throwaway Paystack test key and receipt secret so the Donate pages exist. Random each start, never printed on screen.
  echo "PAYSTACK_SECRET_KEY=sk_test_$(openssl rand -hex 12)"
  echo "DONATE_RECEIPT_TOKEN_SECRET=$(openssl rand -base64 32)"
  cat <<ENV
KB_DEMO=on
KB_DEMO_NOW=$DEMO_NOW
NODE_OPTIONS=--require $PWD/scripts/kb-recorder/demo/fixed-clock.cjs
ENV
}

case "$MODE" in
  env)
    # NODE_OPTIONS holds a space, so it is quoted for `set -a; . file`.
    fixture_env | sed -E 's/^NODE_OPTIONS=(.*)$/NODE_OPTIONS="\1"/'
    ;;
  start)
    while IFS= read -r line; do export "$line"; done < <(fixture_env)
    cd apps/web
    exec pnpm exec next start -p "$PORT"
    ;;
  fixture)
    while IFS= read -r line; do export "$line"; done < <(fixture_env)
    cd apps/web
    exec pnpm exec next dev -p "$PORT"
    ;;
  real)
    PW=dev
    ENV_FILE=.env.kb-real
    psql_admin() { su postgres -c "psql -v ON_ERROR_STOP=1 -q $*"; }
    su postgres -c "psql -v ON_ERROR_STOP=1 -q -f $PWD/packages/db/sql/roles.sql" >/dev/null
    for role in ad_migrator ad_app ad_worker ad_keys_app ad_keys_shred ad_maintenance; do
      psql_admin "-c \"ALTER ROLE $role LOGIN PASSWORD '$PW'\"" >/dev/null
    done
    for db in ad_kb ad_kb_keys; do
      psql_admin "-c \"DROP DATABASE IF EXISTS $db WITH (FORCE)\"" >/dev/null
      psql_admin "-c \"CREATE DATABASE $db OWNER ad_migrator\"" >/dev/null
    done
    STORE="$PWD/.kb-storage"
    rm -rf "$STORE" && mkdir -p "$STORE"
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
DATABASE_URL=postgres://ad_app:$PW@$HOST/ad_kb
DATABASE_URL_WORKER=postgres://ad_worker:$PW@$HOST/ad_kb
DATABASE_URL_MAINTENANCE=postgres://ad_maintenance:$PW@$HOST/ad_kb
DATABASE_URL_MIGRATE=postgres://ad_migrator:$PW@$HOST/ad_kb
KEYS_DATABASE_URL_MIGRATE=postgres://ad_migrator:$PW@$HOST/ad_kb_keys
KEYS_DATABASE_URL=postgres://ad_keys_app:$PW@$HOST/ad_kb_keys
KEYS_DATABASE_URL_SHRED=postgres://ad_keys_shred:$PW@$HOST/ad_kb_keys
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
KB_DEMO_NOW=$DEMO_NOW
NODE_OPTIONS=--require $PWD/scripts/kb-recorder/demo/fixed-clock.cjs
ENV
    while IFS= read -r line; do [ -n "$line" ] && export "$line"; done < "$ENV_FILE"
    pnpm --filter @ad/db db:migrate
    pnpm --filter @ad/catalog run seed:demo
    pnpm --filter @ad/web exec tsx e2e/support/seed.ts
    echo "ready: env in $ENV_FILE. Start the web app with it, then set KB_2FA_CODE for the sign in helper."
    echo "Reset between episodes: re run this script (about a minute)."
    ;;
  *)
    echo "usage: $0 env|fixture|start|real [port]" >&2
    exit 2
    ;;
esac
