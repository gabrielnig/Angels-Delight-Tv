CREATE TABLE "admin_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"video_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "admin_notices_kind_known" CHECK ("admin_notices"."kind" IN ('encode_done', 'encode_failed', 'captions_ready', 'captions_failed'))
);
--> statement-breakpoint
CREATE TABLE "staff_notification_prefs" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"failures" boolean DEFAULT true NOT NULL,
	"captions_ready" boolean DEFAULT false NOT NULL,
	"daily_summary" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_notices" ADD CONSTRAINT "admin_notices_recipient_id_accounts_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notices" ADD CONSTRAINT "admin_notices_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_notification_prefs" ADD CONSTRAINT "staff_notification_prefs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_notices_recipient_created_idx" ON "admin_notices" USING btree ("recipient_id","created_at");--> statement-breakpoint
-- Same reason as 0006: the 0005 grant loop ran before these tables existed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON admin_notices TO ad_app;
    GRANT SELECT, INSERT, UPDATE ON staff_notification_prefs TO ad_app;
  END IF;
END
$$;
