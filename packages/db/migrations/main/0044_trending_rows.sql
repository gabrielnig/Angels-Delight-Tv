ALTER TYPE "public"."row_kind" ADD VALUE 'trending';--> statement-breakpoint
ALTER TYPE "public"."row_kind" ADD VALUE 'top_ten';--> statement-breakpoint
ALTER TYPE "public"."row_kind" ADD VALUE 'most_liked';--> statement-breakpoint
CREATE TABLE "title_scores" (
	"kind" text NOT NULL,
	"video_id" uuid,
	"series_id" uuid,
	"score" double precision NOT NULL,
	"plays" integer NOT NULL,
	"rank" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_scores_kind_known" CHECK ("title_scores"."kind" IN ('trending', 'popular')),
	CONSTRAINT "title_scores_exactly_one_target" CHECK (num_nonnulls("title_scores"."video_id", "title_scores"."series_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "title_scores" ADD CONSTRAINT "title_scores_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_scores" ADD CONSTRAINT "title_scores_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "title_scores_kind_video_uniq" ON "title_scores" USING btree ("kind","video_id") WHERE "title_scores"."video_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "title_scores_kind_series_uniq" ON "title_scores" USING btree ("kind","series_id") WHERE "title_scores"."series_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "title_scores_kind_rank_idx" ON "title_scores" USING btree ("kind","rank");--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT ON title_scores TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON title_scores TO ad_worker;
  END IF;
END
$$;
