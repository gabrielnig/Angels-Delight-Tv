-- Roles from docs/DATA-MODEL.md section 2. Idempotent and password free.
-- Compose init and the integration tests run this as a superuser. Login and passwords are set by the caller.
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['ad_migrator', 'ad_app', 'ad_worker', 'ad_keys_app', 'ad_keys_shred', 'ad_maintenance']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', role_name);
    END IF;
  END LOOP;
END
$$;

-- The migrator needs membership in ad_worker to set default privileges for the tables pg-boss creates as ad_worker.
GRANT ad_worker TO ad_migrator;
