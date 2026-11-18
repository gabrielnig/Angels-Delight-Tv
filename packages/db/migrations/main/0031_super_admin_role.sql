ALTER TYPE "public"."account_role" ADD VALUE 'super_admin';--> statement-breakpoint
ALTER TABLE "admin_invites" DROP CONSTRAINT "admin_invites_staff_role";--> statement-breakpoint
ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_staff_role" CHECK ("admin_invites"."role"::text IN ('editor', 'admin', 'super_admin'));--> statement-breakpoint
-- D-125: Super admin sits above admin. The new enum value cannot be used until this migration commits, so every
-- statement below compares the role as text or inside a function body that is only compiled when it first runs.
DROP POLICY accounts_admin_read ON accounts;--> statement-breakpoint
CREATE POLICY accounts_admin_read ON accounts FOR SELECT
  USING (app_actor_role() IN ('admin', 'super_admin'));--> statement-breakpoint
DROP POLICY profiles_admin_read ON profiles;--> statement-breakpoint
CREATE POLICY profiles_admin_read ON profiles FOR SELECT
  USING (app_actor_role() IN ('admin', 'super_admin'));--> statement-breakpoint
CREATE OR REPLACE FUNCTION keep_one_active_admin() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF OLD.role::text = 'super_admin' AND OLD.status = 'active'
     AND NOT EXISTS (SELECT 1 FROM accounts WHERE role::text = 'super_admin' AND status = 'active') THEN
    RAISE EXCEPTION 'the last active Super admin cannot be demoted, suspended or deleted' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.role::text IN ('admin', 'super_admin') AND OLD.status = 'active'
     AND NOT EXISTS (SELECT 1 FROM accounts WHERE role::text IN ('admin', 'super_admin') AND status = 'active') THEN
    RAISE EXCEPTION 'the last active admin cannot be demoted, suspended or deleted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION staff_set_role(p_actor uuid, p_target uuid, p_role account_role, p_expected account_role)
  RETURNS account_role
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_old account_role;
BEGIN
  IF p_actor IS DISTINCT FROM app_account_id() THEN
    RAISE EXCEPTION 'caller does not match the request context' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_actor AND role::text = 'super_admin' AND status = 'active') THEN
    RAISE EXCEPTION 'caller is not an active Super admin' USING ERRCODE = '42501';
  END IF;
  IF p_actor = p_target THEN
    RAISE EXCEPTION 'a Super admin cannot change their own role' USING ERRCODE = 'AD002';
  END IF;
  SELECT role INTO v_old FROM accounts WHERE id = p_target AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account not found' USING ERRCODE = 'AD003';
  END IF;
  IF v_old <> p_expected THEN
    RAISE EXCEPTION 'role changed by someone else' USING ERRCODE = 'AD004';
  END IF;
  UPDATE accounts SET role = p_role WHERE id = p_target;
  RETURN v_old;
END
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION staff_set_account_status(p_actor uuid, p_target uuid, p_status account_status, p_reason text)
  RETURNS account_status
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_old account_status;
BEGIN
  IF p_actor IS DISTINCT FROM app_account_id() THEN
    RAISE EXCEPTION 'caller does not match the request context' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_actor AND role::text IN ('admin', 'super_admin') AND status = 'active') THEN
    RAISE EXCEPTION 'caller is not an active admin' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'status not allowed' USING ERRCODE = 'AD005';
  END IF;
  SELECT status INTO v_old FROM accounts WHERE id = p_target AND role = 'viewer' AND status IN ('active', 'suspended') FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'viewer not found' USING ERRCODE = 'AD003';
  END IF;
  UPDATE accounts
    SET status = p_status,
        suspended_reason = CASE WHEN p_status = 'suspended' THEN p_reason ELSE NULL END,
        suspended_at = CASE WHEN p_status = 'suspended' THEN now() ELSE NULL END
    WHERE id = p_target;
  RETURN v_old;
END
$$;--> statement-breakpoint
DROP FUNCTION staff_directory(uuid, uuid[]);--> statement-breakpoint
CREATE FUNCTION staff_directory(p_actor uuid, p_ids uuid[])
  RETURNS TABLE (id uuid, email_enc bytea, display_name_enc bytea)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.id = p_actor AND role::text IN ('editor', 'admin', 'super_admin') AND status = 'active') THEN
    RAISE EXCEPTION 'caller is not active staff' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT a.id, a.email_enc, a.display_name_enc FROM accounts a
    WHERE a.id = ANY (p_ids) AND a.role::text IN ('editor', 'admin', 'super_admin') AND a.email_enc IS NOT NULL;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION staff_directory(uuid, uuid[]) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION staff_directory(uuid, uuid[]) TO ad_app;
  END IF;
END
$$;
--> statement-breakpoint
-- M27-S03 AC3: only a Super admin can start the deletion of a viewer account. The re-check lives in SQL so a bug in
-- the app layer cannot let an admin do it. The purge itself is the scheduled job from D-092.
CREATE FUNCTION staff_request_account_deletion(p_actor uuid, p_target uuid, p_purge_after timestamptz)
  RETURNS account_status
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_old account_status;
BEGIN
  IF p_actor IS DISTINCT FROM app_account_id() THEN
    RAISE EXCEPTION 'caller does not match the request context' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_actor AND role::text = 'super_admin' AND status = 'active') THEN
    RAISE EXCEPTION 'caller is not an active Super admin' USING ERRCODE = '42501';
  END IF;
  IF p_actor = p_target THEN
    RAISE EXCEPTION 'a Super admin cannot delete their own account here' USING ERRCODE = 'AD002';
  END IF;
  SELECT status INTO v_old FROM accounts
    WHERE id = p_target AND role = 'viewer' AND status IN ('active', 'suspended') FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'viewer not found' USING ERRCODE = 'AD003';
  END IF;
  UPDATE accounts SET status = 'pending_deletion' WHERE id = p_target;
  INSERT INTO account_deletions (account_id, requested_at, purge_after)
    VALUES (p_target, now(), p_purge_after)
    ON CONFLICT (account_id) DO UPDATE SET requested_at = now(), purge_after = p_purge_after;
  RETURN v_old;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION staff_request_account_deletion(uuid, uuid, timestamptz) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION staff_request_account_deletion(uuid, uuid, timestamptz) TO ad_app;
  END IF;
END
$$;
