ALTER TABLE "sessions" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "device_hash" "bytea";--> statement-breakpoint
CREATE TABLE "login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"session_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	"country" text,
	"ip_trunc" text,
	"user_agent" text,
	"device_hash" "bytea",
	"new_device" boolean DEFAULT false NOT NULL,
	CONSTRAINT "login_events_outcome_known" CHECK ("login_events"."outcome" IN ('success', 'failed', 'mfa_failed', 'locked')),
	CONSTRAINT "login_events_country_code" CHECK ("login_events"."country" IS NULL OR char_length("login_events"."country") = 2)
);
--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_events_account_at_idx" ON "login_events" USING btree ("account_id","at" DESC);--> statement-breakpoint
CREATE INDEX "login_events_at_idx" ON "login_events" USING btree ("at");--> statement-breakpoint
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE login_events FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY login_events_owner ON login_events FOR ALL
  USING (account_id = app_account_id())
  WITH CHECK (account_id = app_account_id());--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON login_events TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_maintenance') THEN
    GRANT SELECT, DELETE ON login_events TO ad_maintenance;
    CREATE POLICY login_events_maintenance ON login_events FOR ALL TO ad_maintenance USING (true) WITH CHECK (true);
  END IF;
END
$$;
