-- app.account_id is set with set_config(..., true), which is transaction scoped. On a pooled connection the
-- setting reads as an empty string after the transaction ends, not NULL, so both helpers map '' to NULL.
-- An unset context therefore matches no rows (fail closed) instead of raising a cast error.
CREATE FUNCTION app_account_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.account_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION app_actor_role() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.actor_role', true), '') $$;
--> statement-breakpoint
CREATE FUNCTION set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER accounts_set_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER videos_set_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER renditions_set_updated_at BEFORE UPDATE ON renditions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER series_set_updated_at BEFORE UPDATE ON series FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER rows_set_updated_at BEFORE UPDATE ON rows FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER video_daily_stats_set_updated_at BEFORE UPDATE ON video_daily_stats FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE FUNCTION enforce_max_profiles() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  max_profiles integer;
  current_profiles integer;
BEGIN
  -- Lock the account row so two concurrent inserts cannot both pass the count.
  PERFORM 1 FROM accounts WHERE id = NEW.account_id FOR UPDATE;
  SELECT coalesce((SELECT (value #>> '{}')::integer FROM settings WHERE key = 'limits.max_profiles'), 5)
    INTO max_profiles;
  SELECT count(*) INTO current_profiles FROM profiles WHERE account_id = NEW.account_id;
  IF current_profiles >= max_profiles THEN
    RAISE EXCEPTION 'profile limit reached for account' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER profiles_enforce_max BEFORE INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION enforce_max_profiles();
--> statement-breakpoint
CREATE FUNCTION audit_log_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF current_user = 'ad_maintenance' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_log is append only' USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
--> statement-breakpoint
-- SECURITY DEFINER so the check sees every admin even when the caller's row level security context shows only itself.
CREATE FUNCTION keep_one_active_admin() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.status = 'active'
     AND NOT EXISTS (SELECT 1 FROM accounts WHERE role = 'admin' AND status = 'active') THEN
    RAISE EXCEPTION 'the last active admin cannot be demoted, suspended or deleted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER accounts_keep_one_admin
  AFTER UPDATE OR DELETE ON accounts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION keep_one_active_admin();
--> statement-breakpoint
-- Pre-login lookup. Returns only what sign in needs, so the app role needs no blanket read policy on accounts.
CREATE FUNCTION auth_find_account(p_email_hash bytea)
  RETURNS TABLE (id uuid, password_hash text, status account_status, role account_role)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT a.id, a.password_hash, a.status, a.role FROM accounts a WHERE a.email_hash = p_email_hash $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_find_account(bytea) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION owns_profile(p_profile_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = p_profile_id AND p.account_id = app_account_id()
    )
  $$;
