#!/bin/sh
# Runs once, on the first start of an empty data volume, after 00-roles.sql (mounted from packages/db/sql/roles.sql).
# Gives the service roles passwords, makes ad_migrator own the app database and creates the separate keys database.
# DB_ROLE_PASSWORD is a throwaway development value. Production credentials never come from this script.
set -eu

psql -v ON_ERROR_STOP=1 -v pw="${DB_ROLE_PASSWORD:-dev}" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
ALTER ROLE ad_migrator LOGIN PASSWORD :'pw';
ALTER ROLE ad_app LOGIN PASSWORD :'pw';
ALTER ROLE ad_worker LOGIN PASSWORD :'pw';
ALTER ROLE ad_keys_app LOGIN PASSWORD :'pw';
ALTER ROLE ad_keys_shred LOGIN PASSWORD :'pw';
ALTER ROLE ad_maintenance LOGIN PASSWORD :'pw';
ALTER DATABASE "$POSTGRES_DB" OWNER TO ad_migrator;
CREATE DATABASE ad_keys OWNER ad_migrator;
SQL
