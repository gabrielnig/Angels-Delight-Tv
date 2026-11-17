-- Lane I: analytics collection. Additive only.
ALTER TABLE view_events ADD COLUMN viewer_hash text;
--> statement-breakpoint
ALTER TABLE view_events ADD COLUMN device_class text;
--> statement-breakpoint
ALTER TABLE view_events ADD COLUMN save_data boolean;
--> statement-breakpoint
ALTER TABLE view_events ADD CONSTRAINT view_events_device_known CHECK (device_class IS NULL OR device_class IN ('phone', 'tablet', 'desktop', 'tv', 'other'));
--> statement-breakpoint
ALTER TABLE view_events ADD CONSTRAINT view_events_kids_no_viewer_hash CHECK (audience <> 'kids' OR viewer_hash IS NULL);
--> statement-breakpoint
CREATE TABLE site_daily_stats (
  day date PRIMARY KEY,
  views integer NOT NULL DEFAULT 0,
  uniques integer NOT NULL DEFAULT 0,
  watch_ms bigint NOT NULL DEFAULT 0,
  completions integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TRIGGER site_daily_stats_set_updated_at BEFORE UPDATE ON site_daily_stats FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TABLE analytics_counters (
  day date NOT NULL,
  kind text NOT NULL,
  key text NOT NULL,
  count bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, key)
);
--> statement-breakpoint
CREATE INDEX view_events_viewer_idx ON view_events (started_at, viewer_hash);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON site_daily_stats, analytics_counters TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON site_daily_stats, analytics_counters TO ad_worker;
  END IF;
END
$$;
