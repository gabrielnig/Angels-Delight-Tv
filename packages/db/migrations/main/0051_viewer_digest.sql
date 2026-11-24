ALTER TABLE "viewer_notices" ADD COLUMN "rank" smallint DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "viewer_notices" ADD CONSTRAINT "viewer_notices_rank_range" CHECK ("viewer_notices"."rank" BETWEEN 0 AND 4);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    CREATE POLICY viewer_notices_definer_read ON viewer_notices FOR SELECT TO ad_migrator USING (true);
    CREATE POLICY viewer_notification_prefs_definer_write ON viewer_notification_prefs FOR UPDATE TO ad_migrator USING (true) WITH CHECK (true);
  END IF;
END
$$;--> statement-breakpoint
-- Unemailed notices of non kids profiles for accounts that chose a digest and have a stored address. A notice counts
-- only when its rank is inside the PRIMARY profile limit, so the email never shows more than the account holder allows.
CREATE FUNCTION notice_digest_candidates(p_since timestamptz)
  RETURNS TABLE (notice_id uuid, account_id uuid, frequency text, address_enc bytea, title text, created_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.id, p.account_id, pr.email_frequency, pr.address_enc, n.title, n.created_at
  FROM viewer_notices n
    JOIN profiles p ON p.id = n.profile_id AND NOT p.is_kids
    JOIN viewer_notification_prefs pr ON pr.account_id = p.account_id
    JOIN profiles prim ON prim.account_id = p.account_id AND prim.is_primary
  WHERE n.emailed_at IS NULL AND n.created_at >= p_since
    AND pr.email_frequency <> 'off' AND pr.address_enc IS NOT NULL
    AND n.rank <= prim.max_maturity_rank
  ORDER BY n.created_at DESC, n.id
$$;--> statement-breakpoint
-- One click unsubscribe from the email, no session: turns the digest off for one account and drops the address.
CREATE FUNCTION viewer_notices_unsubscribe(p_account uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH done AS (
    UPDATE viewer_notification_prefs
    SET email_frequency = 'off', address_enc = NULL, address_consented_at = NULL, updated_at = now()
    WHERE account_id = p_account
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM done)
$$;--> statement-breakpoint
-- The saved copy of the address is only as good as the account email it came from (same rule as staff, 0032).
CREATE FUNCTION forget_viewer_address() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE viewer_notification_prefs SET address_enc = NULL WHERE account_id = NEW.id AND address_enc IS NOT NULL;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER accounts_forget_viewer_address
  AFTER UPDATE OF email_enc ON accounts
  FOR EACH ROW WHEN (OLD.email_enc IS DISTINCT FROM NEW.email_enc)
  EXECUTE FUNCTION forget_viewer_address();--> statement-breakpoint
REVOKE ALL ON FUNCTION notice_digest_candidates(timestamptz), viewer_notices_unsubscribe(uuid) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT EXECUTE ON FUNCTION notice_digest_candidates(timestamptz) TO ad_worker;
    -- The digest skips bounced and complained addresses, so the worker reads the hashed list.
    GRANT SELECT ON email_suppressions TO ad_worker;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION viewer_notices_unsubscribe(uuid) TO ad_app;
  END IF;
END
$$;
