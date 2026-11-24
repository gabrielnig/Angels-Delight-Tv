-- Eight SECURITY DEFINER functions from the ratings, notices and digest migrations pinned `search_path = public`
-- without `pg_temp`. Postgres then looks in the session's temporary schema first, so a temporary table named like a
-- real one would be read by the function with the owner's rights. Pin pg_temp last, as every other definer does.
ALTER FUNCTION title_ratings_refuse_kids() SET search_path = public, pg_temp;--> statement-breakpoint
ALTER FUNCTION title_rating_aggregate() SET search_path = public, pg_temp;--> statement-breakpoint
ALTER FUNCTION viewer_notices_refuse_kids() SET search_path = public, pg_temp;--> statement-breakpoint
ALTER FUNCTION notice_followers(uuid, timestamptz) SET search_path = public, pg_temp;--> statement-breakpoint
ALTER FUNCTION notice_video_audience() SET search_path = public, pg_temp;--> statement-breakpoint
ALTER FUNCTION notice_digest_candidates(timestamptz) SET search_path = public, pg_temp;--> statement-breakpoint
ALTER FUNCTION viewer_notices_unsubscribe(uuid) SET search_path = public, pg_temp;--> statement-breakpoint
ALTER FUNCTION forget_viewer_address() SET search_path = public, pg_temp;
