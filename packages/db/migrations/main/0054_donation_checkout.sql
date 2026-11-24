ALTER TABLE "donations" ADD COLUMN "attempt_key" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "checkout_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "donations_attempt_key_uq" ON "donations" USING btree ("attempt_key") WHERE "donations"."attempt_key" IS NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    -- The definer functions below run as the owner, and FORCE applies policies to the owner too.
    CREATE POLICY donations_definer ON donations TO ad_migrator USING (true) WITH CHECK (true);
  END IF;
END
$$;--> statement-breakpoint
-- The only way the web role starts a donation: a pending row, with the contact fields already sealed by the caller.
-- A repeated attempt key returns the first row, so a double tap never makes a second donation.
CREATE FUNCTION donation_create(
  p_id uuid, p_reference text, p_attempt text, p_kind text, p_currency text, p_amount bigint,
  p_email_enc bytea, p_email_hash bytea, p_name_enc bytea, p_anonymous boolean, p_site_mode text,
  p_account_id uuid, p_checkout_url text
) RETURNS TABLE (reference text, checkout_url text, created boolean)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  DECLARE
    v_id uuid;
  BEGIN
    IF p_reference !~ '^ad-don-[a-z0-9]{20}$' THEN
      RAISE EXCEPTION 'bad donation reference';
    END IF;
    IF p_checkout_url !~ '^https://' THEN
      RAISE EXCEPTION 'bad checkout url';
    END IF;
    INSERT INTO donations (id, reference, attempt_key, kind, currency, amount_minor, donor_email_enc, donor_email_hash,
                           donor_name_enc, anonymous, site_mode, account_id, checkout_url)
    VALUES (p_id, p_reference, p_attempt, p_kind::donation_kind, p_currency, p_amount, p_email_enc, p_email_hash,
            p_name_enc, p_anonymous, p_site_mode, p_account_id, p_checkout_url)
    ON CONFLICT (attempt_key) WHERE attempt_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN
      RETURN QUERY SELECT p_reference, p_checkout_url, true;
    ELSE
      RETURN QUERY SELECT d.reference, d.checkout_url, false FROM donations d WHERE d.attempt_key = p_attempt;
    END IF;
  END
  $$;--> statement-breakpoint
-- A pending attempt by key, so a retry gets the same Paystack page back.
CREATE FUNCTION donation_by_attempt(p_attempt text)
  RETURNS TABLE (reference text, checkout_url text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT d.reference, d.checkout_url FROM donations d
     WHERE d.attempt_key = p_attempt AND d.status = 'pending' AND d.checkout_url IS NOT NULL
  $$;--> statement-breakpoint
-- Status facts for the thank you page. No contact fields, and the caller must already hold the reference.
CREATE FUNCTION donation_public_status(p_reference text)
  RETURNS TABLE (status text, kind text, currency text, amount_minor bigint, paid_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT d.status::text, d.kind::text, d.currency, d.amount_minor, d.paid_at FROM donations d WHERE d.reference = p_reference
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION donation_create(uuid, text, text, text, text, bigint, bytea, bytea, bytea, boolean, text, uuid, text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION donation_by_attempt(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION donation_public_status(text) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION donation_create(uuid, text, text, text, text, bigint, bytea, bytea, bytea, boolean, text, uuid, text) TO ad_app;
    GRANT EXECUTE ON FUNCTION donation_by_attempt(text) TO ad_app;
    GRANT EXECUTE ON FUNCTION donation_public_status(text) TO ad_app;
  END IF;
END
$$;
