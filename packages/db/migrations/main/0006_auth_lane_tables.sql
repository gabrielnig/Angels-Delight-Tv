CREATE TABLE "admin_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" "bytea" NOT NULL,
	"email_enc" "bytea" NOT NULL,
	"role" "account_role" NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_invites_staff_role" CHECK ("admin_invites"."role" IN ('editor', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "auth_lockouts" (
	"key" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"token_id" uuid PRIMARY KEY NOT NULL,
	"code_hash" "bytea" NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_invited_by_accounts_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_token_id_email_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."email_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invites_token_hash_uniq" ON "admin_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_invites_pending_idx" ON "admin_invites" USING btree ("email_hash") WHERE "admin_invites"."accepted_at" IS NULL AND "admin_invites"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "auth_lockouts_updated_idx" ON "auth_lockouts" USING btree ("updated_at");--> statement-breakpoint
-- The 0005 grant loop ran before these tables existed, so the web role gets its access here.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON admin_invites, auth_lockouts, verification_codes TO ad_app;
  END IF;
END
$$;
