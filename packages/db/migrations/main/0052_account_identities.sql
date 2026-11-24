CREATE TABLE "account_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email_hash" "bytea" NOT NULL,
	"email_hint" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "account_identities_provider_known" CHECK ("account_identities"."provider" IN ('google'))
);
--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_live_has_credentials";--> statement-breakpoint
ALTER TABLE "account_identities" ADD CONSTRAINT "account_identities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_identities_provider_subject_uniq" ON "account_identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "account_identities_account_provider_uniq" ON "account_identities" USING btree ("account_id","provider");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_live_has_credentials" CHECK ("accounts"."status" = 'deleted' OR ("accounts"."email_hash" IS NOT NULL AND "accounts"."email_enc" IS NOT NULL));

--> statement-breakpoint
ALTER TABLE account_identities ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE account_identities FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY account_identities_owner ON account_identities FOR ALL
  USING (account_id = app_account_id())
  WITH CHECK (account_id = app_account_id());--> statement-breakpoint
-- Pre sign in lookups. The caller has no account yet, so these two functions run as the owner and return only
-- what the Google flow needs.
CREATE FUNCTION auth_find_identity(p_provider text, p_subject text)
  RETURNS TABLE (account_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT i.account_id FROM account_identities i WHERE i.provider = p_provider AND i.subject = p_subject $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_find_identity(text, text) FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION auth_find_account_for_link(p_email_hash bytea)
  RETURNS TABLE (id uuid, has_password boolean, status account_status, role account_role, email_verified_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT a.id, a.password_hash IS NOT NULL, a.status, a.role, a.email_verified_at FROM accounts a WHERE a.email_hash = p_email_hash $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_find_account_for_link(bytea) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    CREATE POLICY account_identities_definer_read ON account_identities FOR SELECT TO ad_migrator USING (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON account_identities TO ad_app;
    GRANT EXECUTE ON FUNCTION auth_find_identity(text, text), auth_find_account_for_link(bytea) TO ad_app;
  END IF;
END
$$;
