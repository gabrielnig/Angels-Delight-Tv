CREATE TABLE "help_progress" (
	"account_id" uuid NOT NULL,
	"article_id" text NOT NULL,
	"guide_done_at" timestamp with time zone,
	"video_watched_at" timestamp with time zone,
	"helpful" boolean,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_progress_account_id_article_id_pk" PRIMARY KEY("account_id","article_id"),
	CONSTRAINT "help_progress_article_shape" CHECK ("help_progress"."article_id" ~ '^[SDWCMKTR][0-9]{2}$')
);
--> statement-breakpoint
ALTER TABLE "help_progress" ADD CONSTRAINT "help_progress_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE help_progress ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE help_progress FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY help_progress_owner ON help_progress FOR ALL
  USING (account_id = app_account_id())
  WITH CHECK (account_id = app_account_id());--> statement-breakpoint
-- The app role reads and writes its own rows (RLS) and the account purge deletes them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON help_progress TO ad_app;
  END IF;
END $$;
