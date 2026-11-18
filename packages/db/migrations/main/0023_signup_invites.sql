CREATE TABLE "signup_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" "bytea" NOT NULL,
	"hint" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"max_uses" integer NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signup_invites_uses_in_range" CHECK ("signup_invites"."uses" >= 0 AND "signup_invites"."uses" <= "signup_invites"."max_uses"),
	CONSTRAINT "signup_invites_max_uses_range" CHECK ("signup_invites"."max_uses" BETWEEN 1 AND 1000)
);
--> statement-breakpoint
ALTER TABLE "signup_invites" ADD CONSTRAINT "signup_invites_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "signup_invites_code_hash_uniq" ON "signup_invites" USING btree ("code_hash");--> statement-breakpoint
-- Same reason as 0006: the 0005 grant loop ran before this table existed. No delete, codes are revoked instead.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE ON signup_invites TO ad_app;
  END IF;
END
$$;
