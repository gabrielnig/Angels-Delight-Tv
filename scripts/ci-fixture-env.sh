#!/usr/bin/env bash
# Prints an environment for the fixture build of the web app on port ${1:-3113}. No database is needed: viewer, auth
# and admin data come from the in memory fixtures. Used by the a11y and lighthouse CI jobs and for local runs:
#   scripts/ci-fixture-env.sh > .env.ci-fixture
set -euo pipefail
PORT="${1:-3113}"
key() { openssl rand -base64 32; }
cat <<ENV
NODE_ENV=development
APP_ORIGIN=http://localhost:$PORT
MEDIA_ORIGIN=http://localhost:$PORT/api/dev-media
COOKIE_PREFIX_SECURE=false
TRUSTED_PROXY_MODE=none
EDGE_TOKEN_MODE=off
DEV_SKIP_MFA=true
VIEWER_FIXTURES=on
AUTH_FIXTURES=on
ADMIN_FIXTURES=on
ADMIN_DATA=fixture
DATABASE_URL=postgres://u:p@127.0.0.1:1/x
DATABASE_URL_WORKER=postgres://u:p@127.0.0.1:1/x
DATABASE_URL_MAINTENANCE=postgres://u:p@127.0.0.1:1/x
DATABASE_URL_MIGRATE=postgres://u:p@127.0.0.1:1/x
KEYS_DATABASE_URL_MIGRATE=postgres://u:p@127.0.0.1:1/x
KEYS_DATABASE_URL=postgres://u:p@127.0.0.1:1/x
KEYS_DATABASE_URL_SHRED=postgres://u:p@127.0.0.1:1/x
FIELD_KEK=$(key)
EMAIL_HASH_PEPPER=$(key)
HLS_KEK=$(key)
PLAYBACK_TOKEN_SECRET=$(key)
MEDIA_URL_SECRET=$(key)
STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=/tmp/ad-ci-storage
BUCKET_ORIGINALS=ad-originals
BUCKET_MEDIA=ad-media
SMTP_URL=smtp://localhost:1025
EMAIL_FROM=no-reply@localhost
ENV
