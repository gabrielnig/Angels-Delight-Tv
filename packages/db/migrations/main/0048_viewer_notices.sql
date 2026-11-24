CREATE TABLE "viewer_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text NOT NULL,
	"series_id" uuid,
	"video_id" uuid,
	"item_count" integer DEFAULT 1 NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	CONSTRAINT "viewer_notices_kind_known" CHECK ("viewer_notices"."kind" IN ('new_episode', 'new_video'))
);
--> statement-breakpoint
CREATE TABLE "viewer_notification_prefs" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"bell" boolean DEFAULT true NOT NULL,
	"new_episodes" boolean DEFAULT true NOT NULL,
	"new_videos" boolean DEFAULT true NOT NULL,
	"email_frequency" text DEFAULT 'off' NOT NULL,
	"address_enc" "bytea",
	"address_consented_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "viewer_notification_prefs_frequency_known" CHECK ("viewer_notification_prefs"."email_frequency" IN ('off', 'daily', 'weekly'))
);
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "announced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "viewer_notices" ADD CONSTRAINT "viewer_notices_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewer_notices" ADD CONSTRAINT "viewer_notices_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewer_notices" ADD CONSTRAINT "viewer_notices_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewer_notification_prefs" ADD CONSTRAINT "viewer_notification_prefs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "viewer_notices_dedupe_uniq" ON "viewer_notices" USING btree ("profile_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "viewer_notices_profile_created_idx" ON "viewer_notices" USING btree ("profile_id","created_at" DESC NULLS LAST);--> statement-breakpoint
-- Launch day must not flood anyone: every video that is already live counts as announced.
UPDATE "videos" SET "announced_at" = now() WHERE "announced_at" IS NULL AND "deleted_at" IS NULL AND "status" = 'ready' AND ("publish_state" = 'published' OR ("publish_state" = 'scheduled' AND "publish_at" <= now()));--> statement-breakpoint
CREATE INDEX "videos_unannounced_idx" ON "videos" USING btree ("id") WHERE "announced_at" IS NULL;--> statement-breakpoint
ALTER TABLE viewer_notices ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE viewer_notices FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE viewer_notification_prefs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE viewer_notification_prefs FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY viewer_notices_owner_read ON viewer_notices FOR SELECT TO PUBLIC USING (owns_profile(profile_id));--> statement-breakpoint
CREATE POLICY viewer_notices_owner_update ON viewer_notices FOR UPDATE TO PUBLIC
  USING (owns_profile(profile_id)) WITH CHECK (owns_profile(profile_id));--> statement-breakpoint
CREATE POLICY viewer_notices_owner_delete ON viewer_notices FOR DELETE TO PUBLIC USING (owns_profile(profile_id));--> statement-breakpoint
CREATE POLICY viewer_notification_prefs_owner ON viewer_notification_prefs FOR ALL
  USING (account_id = app_account_id())
  WITH CHECK (account_id = app_account_id());--> statement-breakpoint
-- Notices never name a kids profile, whoever writes them (L5, M44-S17).
CREATE FUNCTION viewer_notices_refuse_kids() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles p WHERE p.id = NEW.profile_id AND p.is_kids) THEN
    RAISE EXCEPTION 'kids profiles get no notices' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER viewer_notices_not_kids BEFORE INSERT ON viewer_notices
  FOR EACH ROW EXECUTE FUNCTION viewer_notices_refuse_kids();--> statement-breakpoint
-- The functions below are SECURITY DEFINER and FORCE applies policies to the owner, so the owner role gets read
-- only policies (same pattern as title_ratings_definer_read). The worker never reads my_list or watch_progress.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    CREATE POLICY my_list_definer_read ON my_list FOR SELECT TO ad_migrator USING (true);
    CREATE POLICY watch_progress_definer_read ON watch_progress FOR SELECT TO ad_migrator USING (true);
    CREATE POLICY viewer_notification_prefs_definer_read ON viewer_notification_prefs FOR SELECT TO ad_migrator USING (true);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_definer_read') THEN
      CREATE POLICY profiles_definer_read ON profiles FOR SELECT TO ad_migrator USING (true);
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    CREATE POLICY viewer_notices_worker ON viewer_notices FOR ALL TO ad_worker USING (true) WITH CHECK (true);
    CREATE POLICY viewer_notification_prefs_worker_read ON viewer_notification_prefs FOR SELECT TO ad_worker USING (true);
  END IF;
END
$$;--> statement-breakpoint
-- Profiles that follow a series and want episode notices: it is in My List, or an episode was watched since the
-- given time. Returns ids and the maturity limit only, never kids profiles.
CREATE FUNCTION notice_followers(p_series uuid, p_since timestamptz)
  RETURNS TABLE (profile_id uuid, max_rank smallint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.max_maturity_rank
  FROM profiles p
  LEFT JOIN viewer_notification_prefs n ON n.account_id = p.account_id
  WHERE NOT p.is_kids AND coalesce(n.new_episodes, true)
    AND (
      EXISTS (SELECT 1 FROM my_list ml WHERE ml.profile_id = p.id AND ml.series_id = p_series)
      OR EXISTS (
        SELECT 1 FROM watch_progress wp
          JOIN episodes e ON e.video_id = wp.video_id
          JOIN seasons s ON s.id = e.season_id
        WHERE wp.profile_id = p.id AND s.series_id = p_series AND wp.updated_at >= p_since)
    )
$$;--> statement-breakpoint
-- Every non kids profile whose account wants new video notices.
CREATE FUNCTION notice_video_audience()
  RETURNS TABLE (profile_id uuid, max_rank smallint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.max_maturity_rank
  FROM profiles p
  LEFT JOIN viewer_notification_prefs n ON n.account_id = p.account_id
  WHERE NOT p.is_kids AND coalesce(n.new_videos, true)
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION notice_followers(uuid, timestamptz), notice_video_audience() FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, DELETE ON viewer_notices TO ad_app;
    GRANT UPDATE (read_at) ON viewer_notices TO ad_app;
    GRANT SELECT, INSERT, UPDATE ON viewer_notification_prefs TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON viewer_notices TO ad_worker;
    GRANT SELECT ON viewer_notification_prefs TO ad_worker;
    GRANT SELECT ON series, seasons, episodes TO ad_worker;
    GRANT EXECUTE ON FUNCTION notice_followers(uuid, timestamptz), notice_video_audience() TO ad_worker;
  END IF;
END
$$;
