-- L-2: the staff functions trusted the p_actor argument. They now also require it to equal the account in the
-- request context (set by withAccount), so a caller cannot pass another admin's id.
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
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_actor AND role = 'admin' AND status = 'active') THEN
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
$$;
