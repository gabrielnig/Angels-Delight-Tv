-- Staff can choose a display name on My account. The directory now returns it next to the sealed email,
-- so other staff see the chosen name and the app falls back to the address when there is none.
DROP FUNCTION staff_directory(uuid, uuid[]);
--> statement-breakpoint
CREATE FUNCTION staff_directory(p_actor uuid, p_ids uuid[])
  RETURNS TABLE (id uuid, email_enc bytea, display_name_enc bytea)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.id = p_actor AND role IN ('editor', 'admin') AND status = 'active') THEN
    RAISE EXCEPTION 'caller is not active staff' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT a.id, a.email_enc, a.display_name_enc FROM accounts a
    WHERE a.id = ANY (p_ids) AND a.role IN ('editor', 'admin') AND a.email_enc IS NOT NULL;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION staff_directory(uuid, uuid[]) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION staff_directory(uuid, uuid[]) TO ad_app;
  END IF;
END
$$;
