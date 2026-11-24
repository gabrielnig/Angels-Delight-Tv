CREATE TABLE "video_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_markers_video_kind_uniq" UNIQUE("video_id","kind"),
	CONSTRAINT "video_markers_kind_known" CHECK ("video_markers"."kind" IN ('intro', 'recap', 'credits')),
	CONSTRAINT "video_markers_start_nonneg" CHECK ("video_markers"."start_ms" >= 0),
	CONSTRAINT "video_markers_end_after_start" CHECK ("video_markers"."end_ms" IS NULL OR "video_markers"."end_ms" > "video_markers"."start_ms"),
	CONSTRAINT "video_markers_end_required" CHECK ("video_markers"."kind" = 'credits' OR "video_markers"."end_ms" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "video_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"start_ms" integer NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_chapters_video_start_uniq" UNIQUE("video_id","start_ms"),
	CONSTRAINT "video_chapters_start_nonneg" CHECK ("video_chapters"."start_ms" >= 0),
	CONSTRAINT "video_chapters_title_length" CHECK (char_length("video_chapters"."title") BETWEEN 1 AND 60)
);
--> statement-breakpoint
ALTER TABLE "video_markers" ADD CONSTRAINT "video_markers_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_markers" ADD CONSTRAINT "video_markers_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_chapters" ADD CONSTRAINT "video_chapters_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_chapters_video_idx" ON "video_chapters" USING btree ("video_id","start_ms");--> statement-breakpoint
-- Same reason as 0006: the 0005 grant loop ran before these tables existed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON video_markers TO ad_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON video_chapters TO ad_app;
  END IF;
END
$$;
