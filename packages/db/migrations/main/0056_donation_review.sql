-- An admin settles a gift that was flagged for review: accept makes it succeeded, reject makes it failed. The web
-- role has no update right on donations, so this is the only way it can change one. The note is kept on the row.
CREATE FUNCTION donation_review_resolve(p_id uuid, p_accept boolean, p_note text)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  DECLARE
    v_changed integer;
  BEGIN
    IF NOT coalesce(app_actor_role() IN ('admin', 'super_admin'), false) THEN
      RAISE EXCEPTION 'only an admin can resolve a donation review' USING ERRCODE = '42501';
    END IF;
    IF p_note IS NULL OR length(btrim(p_note)) = 0 OR length(p_note) > 500 THEN
      RAISE EXCEPTION 'a note of 1 to 500 characters is required' USING ERRCODE = '22023';
    END IF;
    UPDATE donations
       SET status = CASE WHEN p_accept THEN 'succeeded'::donation_status ELSE 'failed'::donation_status END,
           paid_at = CASE WHEN p_accept THEN coalesce(paid_at, now()) ELSE paid_at END,
           review_reason = 'resolved: ' || btrim(p_note)
     WHERE id = p_id AND status = 'needs_review';
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    RETURN v_changed = 1;
  END
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION donation_review_resolve(uuid, boolean, text) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION donation_review_resolve(uuid, boolean, text) TO ad_app;
  END IF;
END
$$;
