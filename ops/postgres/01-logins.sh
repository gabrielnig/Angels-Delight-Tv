#!/bin/sh
# Production first start of an empty data volume, after 00-roles.sql (packages/db/sql/roles.sql).
# One password per role, from DB_PASSWORD_* in the env file, so a leak of one container does not open the others.
# Creates the separate keys database owned by the migrator. Never runs again on a volume that already has data.
set -eu

for name in MIGRATOR APP WORKER KEYS_APP KEYS_SHRED MAINTENANCE; do
  eval "value=\${DB_PASSWORD_$name:-}"
  if [ -z "$value" ]; then
    echo "DB_PASSWORD_$name is empty. Run pnpm secrets:generate first." >&2
    exit 1
  fi
done

psql -v ON_ERROR_STOP=1 \
  -v pw_migrator="$DB_PASSWORD_MIGRATOR" -v pw_app="$DB_PASSWORD_APP" -v pw_worker="$DB_PASSWORD_WORKER" \
  -v pw_keys_app="$DB_PASSWORD_KEYS_APP" -v pw_keys_shred="$DB_PASSWORD_KEYS_SHRED" \
  -v pw_maintenance="$DB_PASSWORD_MAINTENANCE" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
ALTER ROLE ad_migrator LOGIN PASSWORD :'pw_migrator';
ALTER ROLE ad_app LOGIN PASSWORD :'pw_app';
ALTER ROLE ad_worker LOGIN PASSWORD :'pw_worker';
ALTER ROLE ad_keys_app LOGIN PASSWORD :'pw_keys_app';
ALTER ROLE ad_keys_shred LOGIN PASSWORD :'pw_keys_shred';
ALTER ROLE ad_maintenance LOGIN PASSWORD :'pw_maintenance';
ALTER DATABASE "$POSTGRES_DB" OWNER TO ad_migrator;
CREATE DATABASE ad_keys OWNER ad_migrator;
SQL
