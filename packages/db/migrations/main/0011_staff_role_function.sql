-- Role changes touch another person's account row, which row level security hides from the app role.
-- This SECURITY DEFINER function does the one write the admin screens need and re-checks the caller in SQL,
-- so a bug in the app layer cannot promote anyone. Distinct SQLSTATEs let the service map each refusal.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    CREATE POLICY accounts_definer_update ON accounts FOR UPDATE TO ad_migrator USING (true) WITH CHECK (true);
  END IF;
END
$$;
--> statement-breakpoint
CREATE FUNCTION staff_set_role(p_actor uuid, p_target uuid, p_role account_role, p_expected account_role)
  RETURNS account_role
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_old account_role;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_actor AND role = 'admin' AND status = 'active') THEN
    RAISE EXCEPTION 'caller is not an active admin' USING ERRCODE = '42501';
  END IF;
  IF p_actor = p_target THEN
    RAISE EXCEPTION 'an admin cannot change their own role' USING ERRCODE = 'AD002';
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
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION staff_set_role(uuid, uuid, account_role, account_role) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION staff_set_role(uuid, uuid, account_role, account_role) TO ad_app;
  END IF;
END
$$;
