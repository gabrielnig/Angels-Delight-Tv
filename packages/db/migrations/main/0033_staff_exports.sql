CREATE TABLE "staff_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scope" text DEFAULT 'all' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"row_count" integer,
	"bytes" bigint,
	"file_key" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "staff_exports_kind_known" CHECK ("staff_exports"."kind" IN ('audit', 'analytics')),
	CONSTRAINT "staff_exports_scope_known" CHECK ("staff_exports"."scope" IN ('all', 'content')),
	CONSTRAINT "staff_exports_status_known" CHECK ("staff_exports"."status" IN ('queued', 'running', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "staff_exports" ADD CONSTRAINT "staff_exports_requester_id_accounts_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_exports_requester_idx" ON "staff_exports" USING btree ("requester_id","created_at");--> statement-breakpoint
-- Same reason as 0006: the 0005 grant loop ran before this table existed. The worker builds the files, so it
-- also needs to read the audit log (it could only write to it) and to clean up expired export rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE ON staff_exports TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT, UPDATE, DELETE ON staff_exports TO ad_worker;
    GRANT SELECT ON audit_log TO ad_worker;
  END IF;
END
$$;
--> statement-breakpoint
-- A person only ever sees their own exports, even if a query forgets to filter. The worker sees all of them.
ALTER TABLE staff_exports ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE staff_exports FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY staff_exports_owner ON staff_exports
  USING (requester_id = app_account_id()) WITH CHECK (requester_id = app_account_id());
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    CREATE POLICY staff_exports_worker ON staff_exports TO ad_worker USING (true) WITH CHECK (true);
  END IF;
END
$$;
