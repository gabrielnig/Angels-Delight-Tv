-- Accent insensitive search (M06). unaccent() is only STABLE, so an index cannot use it directly. The wrapper pins
-- the dictionary and is declared IMMUTABLE, which is safe because the dictionary never changes at runtime.
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE FUNCTION ad_unaccent(input text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, input) $$;
--> statement-breakpoint
-- Weighted document: title (A) ranks above description (B). Search queries repeat these expressions verbatim so the planner uses the indexes.
CREATE INDEX videos_search_unaccent_idx ON videos USING gin (
  (setweight(to_tsvector('simple', ad_unaccent(title)), 'A') || setweight(to_tsvector('simple', ad_unaccent(coalesce(description, ''))), 'B'))
);
--> statement-breakpoint
CREATE INDEX series_search_unaccent_idx ON series USING gin (
  (setweight(to_tsvector('simple', ad_unaccent(title)), 'A') || setweight(to_tsvector('simple', ad_unaccent(coalesce(description, ''))), 'B'))
);
--> statement-breakpoint
CREATE INDEX videos_title_unaccent_trgm_idx ON videos USING gin (ad_unaccent(lower(title)) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX series_title_unaccent_trgm_idx ON series USING gin (ad_unaccent(lower(title)) gin_trgm_ops);
--> statement-breakpoint
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE search_history FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY search_history_owner ON search_history FOR ALL
  USING (owns_profile(profile_id))
  WITH CHECK (owns_profile(profile_id));
--> statement-breakpoint
-- Migration 0005 granted the tables that existed then. The two new tables need the same app role grants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON search_history, slug_redirects TO ad_app;
  END IF;
END
$$;
