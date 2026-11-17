-- Suspending a viewer touches another person's account row, which row level security hides from the app role.
-- Like staff_set_role, this SECURITY DEFINER function re-checks the caller in SQL and only ever touches viewers.
CREATE FUNCTION staff_set_account_status(p_actor uuid, p_target uuid, p_status account_status, p_reason text)
  RETURNS account_status
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_old account_status;
BEGIN
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
--> statement-breakpoint
REVOKE ALL ON FUNCTION staff_set_account_status(uuid, uuid, account_status, text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION staff_set_account_status(uuid, uuid, account_status, text) TO ad_app;
  END IF;
END
$$;
