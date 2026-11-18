CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"size_bytes" integer,
	"requested_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	CONSTRAINT "data_exports_status_known" CHECK ("data_exports"."status" IN ('pending', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_exports_account_idx" ON "data_exports" USING btree ("account_id","requested_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "data_exports_pending_idx" ON "data_exports" USING btree ("requested_at") WHERE "data_exports"."status" = 'pending';--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON data_exports TO ad_app;
  END IF;
END
$$;
