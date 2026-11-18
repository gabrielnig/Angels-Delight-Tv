CREATE TABLE "email_suppressions" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_suppressions_reason_known" CHECK ("email_suppressions"."reason" IN ('bounce', 'complaint'))
);
--> statement-breakpoint
-- Same reason as 0006: the 0005 grant loop ran before this table existed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE ON email_suppressions TO ad_app;
  END IF;
END
$$;
