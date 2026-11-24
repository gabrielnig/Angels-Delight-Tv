CREATE TABLE "title_rating_stats" (
	"video_id" uuid,
	"series_id" uuid,
	"dislikes" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"loves" integer DEFAULT 0 NOT NULL,
	"most_liked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_rating_stats_exactly_one_target" CHECK (num_nonnulls("title_rating_stats"."video_id", "title_rating_stats"."series_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "title_ratings" (
	"profile_id" uuid NOT NULL,
	"video_id" uuid,
	"series_id" uuid,
	"value" smallint NOT NULL,
	"rated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_ratings_value_known" CHECK ("title_ratings"."value" IN (-1, 1, 2)),
	CONSTRAINT "title_ratings_exactly_one_target" CHECK (num_nonnulls("title_ratings"."video_id", "title_ratings"."series_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "title_rating_stats" ADD CONSTRAINT "title_rating_stats_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_rating_stats" ADD CONSTRAINT "title_rating_stats_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_ratings" ADD CONSTRAINT "title_ratings_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_ratings" ADD CONSTRAINT "title_ratings_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_ratings" ADD CONSTRAINT "title_ratings_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "title_rating_stats_video_uniq" ON "title_rating_stats" USING btree ("video_id") WHERE "title_rating_stats"."video_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "title_rating_stats_series_uniq" ON "title_rating_stats" USING btree ("series_id") WHERE "title_rating_stats"."series_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "title_ratings_profile_video_uniq" ON "title_ratings" USING btree ("profile_id","video_id") WHERE "title_ratings"."video_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "title_ratings_profile_series_uniq" ON "title_ratings" USING btree ("profile_id","series_id") WHERE "title_ratings"."series_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "title_ratings_video_idx" ON "title_ratings" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "title_ratings_series_idx" ON "title_ratings" USING btree ("series_id");--> statement-breakpoint
ALTER TABLE title_ratings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE title_ratings FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY title_ratings_owner ON title_ratings FOR ALL
  USING (owns_profile(profile_id))
  WITH CHECK (owns_profile(profile_id));--> statement-breakpoint
-- The aggregate function below is SECURITY DEFINER and FORCE applies policies to the owner, so the owner role
-- gets a read only policy (same pattern as accounts_definer_read).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    CREATE POLICY title_ratings_definer_read ON title_ratings FOR SELECT TO ad_migrator USING (true);
    CREATE POLICY profiles_definer_read ON profiles FOR SELECT TO ad_migrator USING (true);
  END IF;
END
$$;--> statement-breakpoint
CREATE FUNCTION title_ratings_refuse_kids() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles p WHERE p.id = NEW.profile_id AND p.is_kids) THEN
    RAISE EXCEPTION 'kids profiles cannot rate titles' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER title_ratings_not_kids BEFORE INSERT OR UPDATE ON title_ratings
  FOR EACH ROW EXECUTE FUNCTION title_ratings_refuse_kids();--> statement-breakpoint
CREATE FUNCTION title_rating_aggregate()
  RETURNS TABLE (video_id uuid, series_id uuid, dislikes integer, likes integer, loves integer)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.video_id, r.series_id,
    (count(*) FILTER (WHERE r.value = -1))::integer,
    (count(*) FILTER (WHERE r.value = 1))::integer,
    (count(*) FILTER (WHERE r.value = 2))::integer
  FROM title_ratings r GROUP BY r.video_id, r.series_id
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION title_rating_aggregate() FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON title_ratings TO ad_app;
    GRANT SELECT ON title_rating_stats TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON title_rating_stats TO ad_worker;
    GRANT EXECUTE ON FUNCTION title_rating_aggregate() TO ad_worker;
  END IF;
END
$$;
