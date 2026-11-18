CREATE TABLE "watch_progress_removals" (
	"profile_id" uuid NOT NULL,
	"requested_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"position_ms" integer NOT NULL,
	"removed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_progress_removals_profile_id_requested_id_pk" PRIMARY KEY("profile_id","requested_id"),
	CONSTRAINT "watch_progress_removals_position_nonnegative" CHECK ("watch_progress_removals"."position_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "watch_progress_removals" ADD CONSTRAINT "watch_progress_removals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress_removals" ADD CONSTRAINT "watch_progress_removals_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE watch_progress_removals ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE watch_progress_removals FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY watch_progress_removals_owner ON watch_progress_removals FOR ALL
  USING (owns_profile(profile_id))
  WITH CHECK (owns_profile(profile_id));--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON watch_progress_removals TO ad_app;
  END IF;
END
$$;
