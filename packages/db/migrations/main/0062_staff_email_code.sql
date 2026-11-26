-- L16 (D-397): staff can use an emailed one time code as the second sign in step. The code reuses email_tokens and
-- verification_codes (hashed, attempt counted), so only the two new purposes are added. Own file: a new enum value cannot
-- be used in the transaction that adds it. No new table, so purge, export and row level security are unchanged.
ALTER TYPE "token_purpose" ADD VALUE IF NOT EXISTS 'staff_sign_in';--> statement-breakpoint
ALTER TYPE "token_purpose" ADD VALUE IF NOT EXISTS 'staff_confirm';
--> statement-breakpoint
-- A staff device that passed the emailed code with "Remember this device". Only the SHA-256 of the cookie token is kept,
-- and a row works only for the account it was made for. It ends at expires_at, on revoke, and with every sign out
-- everywhere, password change, password reset and role change (SessionService.revokeAll).
CREATE TABLE "trusted_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"label" text NOT NULL,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "trusted_devices_country_code" CHECK ("trusted_devices"."country" IS NULL OR char_length("trusted_devices"."country") = 2),
	CONSTRAINT "trusted_devices_expiry_after_creation" CHECK ("trusted_devices"."expires_at" > "trusted_devices"."created_at")
);
--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trusted_devices_token_hash_uniq" ON "trusted_devices" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "trusted_devices_account_idx" ON "trusted_devices" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE trusted_devices FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY trusted_devices_owner ON trusted_devices FOR ALL
  USING (account_id = app_account_id())
  WITH CHECK (account_id = app_account_id());--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON trusted_devices TO ad_app;
  END IF;
END
$$;
