CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"recipient_id" uuid,
	"to_enc" "bytea" NOT NULL,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"provider_message_id" text,
	"last_error" text,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_outbox_status_known" CHECK ("email_outbox"."status" IN ('queued', 'sending', 'sent', 'failed')),
	CONSTRAINT "email_outbox_attempts_range" CHECK ("email_outbox"."attempts" BETWEEN 0 AND 20)
);
--> statement-breakpoint
ALTER TABLE "admin_notices" ADD COLUMN "emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff_notification_prefs" ADD COLUMN "email_frequency" text DEFAULT 'hourly' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_notification_prefs" ADD COLUMN "address_enc" "bytea";--> statement-breakpoint
CREATE INDEX "email_outbox_due_idx" ON "email_outbox" USING btree ("next_attempt_at") WHERE "email_outbox"."status" IN ('queued', 'sending');--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_dedupe_uniq" ON "email_outbox" USING btree ("dedupe_key") WHERE "email_outbox"."dedupe_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_notification_prefs" ADD CONSTRAINT "staff_notification_prefs_frequency_known" CHECK ("staff_notification_prefs"."email_frequency" IN ('immediate', 'hourly', 'daily'));
--> statement-breakpoint
-- Same reason as 0006: the 0005 grant loop ran before these tables existed. The worker also never had access to
-- admin_notices (0027 granted only the app role), so bell notices written by the worker are fixed here too.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE ON email_outbox TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON email_outbox TO ad_worker;
    GRANT SELECT, INSERT, UPDATE, DELETE ON admin_notices TO ad_worker;
    GRANT SELECT, UPDATE ON staff_notification_prefs TO ad_worker;
  END IF;
END
$$;
--> statement-breakpoint
-- The worker has no access to accounts. This lists the ids of active staff and nothing else, so notices reach
-- the right people without opening the identity tables.
CREATE FUNCTION active_staff_ids() RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT id FROM accounts WHERE role::text IN ('editor', 'admin', 'super_admin') AND status = 'active' $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION active_staff_ids() FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION active_staff_ids() TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT EXECUTE ON FUNCTION active_staff_ids() TO ad_worker;
  END IF;
END
$$;
--> statement-breakpoint
-- The saved copy of a staff address is only as good as the account email it was taken from. When the email
-- changes, drop the copy: summaries skip that person until the app saves the new address, and nothing is ever
-- mailed to the old one.
CREATE FUNCTION forget_staff_address() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  UPDATE staff_notification_prefs SET address_enc = NULL WHERE account_id = NEW.id AND address_enc IS NOT NULL;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER accounts_forget_staff_address
  AFTER UPDATE OF email_enc ON accounts
  FOR EACH ROW WHEN (OLD.email_enc IS DISTINCT FROM NEW.email_enc)
  EXECUTE FUNCTION forget_staff_address();
