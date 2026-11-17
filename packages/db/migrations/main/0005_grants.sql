-- Grants per docs/DATA-MODEL.md section 2. Each block is skipped when its role does not exist, so the same
-- migrations run on a developer database that has no per-service roles.
CREATE SCHEMA IF NOT EXISTS pgboss;
--> statement-breakpoint
DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT USAGE ON SCHEMA public TO ad_app;
    FOR table_name IN
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'audit_log'
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO ad_app', table_name);
    END LOOP;
    GRANT SELECT, INSERT ON audit_log TO ad_app;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ad_app;
    GRANT EXECUTE ON FUNCTION auth_find_account(bytea), owns_profile(uuid), app_account_id(), app_actor_role() TO ad_app;
    GRANT USAGE ON SCHEMA pgboss TO ad_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT USAGE ON SCHEMA public TO ad_worker;
    FOREACH table_name IN ARRAY ARRAY[
      'videos', 'renditions', 'video_keys', 'assets', 'captions', 'caption_tracks', 'jobs',
      'upload_sessions', 'view_events', 'video_daily_stats', 'rate_limit_buckets'
    ] LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO ad_worker', table_name);
    END LOOP;
    GRANT SELECT ON settings TO ad_worker;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ad_worker;
    GRANT USAGE, CREATE ON SCHEMA pgboss TO ad_worker;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_maintenance') THEN
    GRANT USAGE ON SCHEMA public TO ad_maintenance;
    GRANT SELECT, DELETE ON audit_log, view_events TO ad_maintenance;
  END IF;

  -- pg-boss creates its tables as ad_worker. The web app enqueues jobs, so it inherits access to them.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE ad_worker IN SCHEMA pgboss
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ad_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE ad_worker IN SCHEMA pgboss
      GRANT USAGE ON SEQUENCES TO ad_app;
  END IF;
END
$$;
