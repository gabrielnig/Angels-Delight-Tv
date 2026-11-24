CREATE TYPE "public"."donation_kind" AS ENUM('one_time', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."donation_status" AS ENUM('pending', 'succeeded', 'failed', 'abandoned', 'refunded', 'needs_review');--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"provider" text DEFAULT 'paystack' NOT NULL,
	"provider_txn_id" text,
	"kind" "donation_kind" DEFAULT 'one_time' NOT NULL,
	"status" "donation_status" DEFAULT 'pending' NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"paid_amount_minor" bigint,
	"fee_minor" bigint,
	"net_minor" bigint,
	"channel" text,
	"donor_email_enc" "bytea" NOT NULL,
	"donor_email_hash" "bytea" NOT NULL,
	"donor_name_enc" "bytea",
	"message_enc" "bytea",
	"anonymous" boolean DEFAULT false NOT NULL,
	"account_id" uuid,
	"subscription_id" uuid,
	"source" text DEFAULT 'paystack' NOT NULL,
	"site_mode" text NOT NULL,
	"review_reason" text,
	"paid_at" timestamp with time zone,
	"receipt_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donations_amount_positive" CHECK ("donations"."amount_minor" > 0),
	CONSTRAINT "donations_paid_amount_positive" CHECK ("donations"."paid_amount_minor" IS NULL OR "donations"."paid_amount_minor" > 0),
	CONSTRAINT "donations_currency_known" CHECK ("donations"."currency" IN ('NGN', 'USD')),
	CONSTRAINT "donations_source_known" CHECK ("donations"."source" IN ('paystack', 'manual')),
	CONSTRAINT "donations_site_mode_known" CHECK ("donations"."site_mode" IN ('test', 'live'))
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'paystack' NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"reference" text,
	"payload_enc" "bytea",
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"outcome" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "donations_reference_uq" ON "donations" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "donations_status_created_idx" ON "donations" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "donations_email_hash_idx" ON "donations" USING btree ("donor_email_hash");--> statement-breakpoint
CREATE INDEX "donations_subscription_idx" ON "donations" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "donations_account_idx" ON "donations" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_key_uq" ON "payment_events" USING btree ("provider","event_key");--> statement-breakpoint
CREATE INDEX "payment_events_unprocessed_idx" ON "payment_events" USING btree ("received_at") WHERE "payment_events"."processed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "payment_events_reference_idx" ON "payment_events" USING btree ("reference");--> statement-breakpoint
CREATE TRIGGER donations_set_updated_at BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE donations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE payment_events FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Admins read every donation. A signed in donor reads their own. Editors and guests read none.
CREATE POLICY donations_admin_read ON donations FOR SELECT
  USING (coalesce(app_actor_role() IN ('admin', 'super_admin'), false));--> statement-breakpoint
CREATE POLICY donations_owner_read ON donations FOR SELECT
  USING (account_id IS NOT NULL AND account_id = app_account_id());--> statement-breakpoint
CREATE POLICY payment_events_admin_read ON payment_events FOR SELECT
  USING (coalesce(app_actor_role() IN ('admin', 'super_admin'), false));--> statement-breakpoint
-- The only write path for webhook events from the web role. Returns the new id, or null for a repeat.
CREATE FUNCTION payment_event_insert(
  p_provider text, p_event_key text, p_event_type text, p_reference text, p_payload bytea
) RETURNS bigint
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    INSERT INTO payment_events (provider, event_key, event_type, reference, payload_enc)
    VALUES (p_provider, p_event_key, p_event_type, p_reference, p_payload)
    ON CONFLICT (provider, event_key) DO NOTHING
    RETURNING id
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION payment_event_insert(text, text, text, text, bytea) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    -- The SECURITY DEFINER function runs as the owner, and FORCE applies policies to the owner too.
    CREATE POLICY payment_events_definer ON payment_events TO ad_migrator USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT ON donations TO ad_app;
    GRANT SELECT ON payment_events TO ad_app;
    GRANT EXECUTE ON FUNCTION payment_event_insert(text, text, text, text, bytea) TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT, INSERT, UPDATE ON donations TO ad_worker;
    GRANT SELECT, UPDATE ON payment_events TO ad_worker;
    CREATE POLICY donations_worker ON donations TO ad_worker USING (true) WITH CHECK (true);
    CREATE POLICY payment_events_worker ON payment_events TO ad_worker USING (true) WITH CHECK (true);
  END IF;
END
$$;
