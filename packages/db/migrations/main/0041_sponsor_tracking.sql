-- Distinct viewers per day for the reach figure. Holds only a daily rotating hash, pruned after two days (D-253).
CREATE TABLE "sponsor_reach_seen" (
	"day" date NOT NULL,
	"creative_id" uuid NOT NULL,
	"slot" "sponsor_slot" NOT NULL,
	"viewer_hash" text NOT NULL,
	CONSTRAINT "sponsor_reach_seen_pk" PRIMARY KEY("day","creative_id","slot","viewer_hash")
);--> statement-breakpoint
ALTER TABLE sponsor_reach_seen ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsor_reach_seen FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- One call records an impression ('imp', with an optional viewer hash for reach) or a click ('clk'). Nothing is
-- recorded unless the creative belongs to a live sponsor and is placed in that slot, so a tampered id counts nothing.
CREATE FUNCTION sponsor_track(p_day date, p_creative uuid, p_slot sponsor_slot, p_hash text, p_kind text)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_sponsor uuid;
  v_new boolean := false;
BEGIN
  IF p_kind NOT IN ('imp', 'clk') THEN RETURN false; END IF;
  SELECT s.id INTO v_sponsor
    FROM sponsor_creatives c
    JOIN sponsors s ON s.id = c.sponsor_id
    JOIN sponsor_placements p ON p.creative_id = c.id AND p.slot = p_slot
   WHERE c.id = p_creative AND c.active
     AND sponsor_effective(s.status, s.starts_at, s.ends_at, now()) = 'live';
  IF v_sponsor IS NULL THEN RETURN false; END IF;
  IF p_kind = 'imp' AND p_hash IS NOT NULL THEN
    INSERT INTO sponsor_reach_seen (day, creative_id, slot, viewer_hash)
    VALUES (p_day, p_creative, p_slot, p_hash) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_new = ROW_COUNT;
  END IF;
  PERFORM sponsor_stats_bump(p_day, v_sponsor, p_creative, p_slot,
    CASE WHEN p_kind = 'imp' THEN 1 ELSE 0 END,
    CASE WHEN p_kind = 'clk' THEN 1 ELSE 0 END,
    CASE WHEN v_new THEN 1 ELSE 0 END);
  RETURN true;
END
$$;--> statement-breakpoint
CREATE FUNCTION sponsor_reach_prune() RETURNS integer
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ WITH d AS (DELETE FROM sponsor_reach_seen WHERE day < current_date - 2 RETURNING 1) SELECT count(*)::int FROM d $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION sponsor_track(date, uuid, sponsor_slot, text, text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION sponsor_reach_prune() FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    CREATE POLICY sponsor_reach_seen_definer ON sponsor_reach_seen TO ad_migrator USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT EXECUTE ON FUNCTION sponsor_track(date, uuid, sponsor_slot, text, text) TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT EXECUTE ON FUNCTION sponsor_track(date, uuid, sponsor_slot, text, text) TO ad_worker;
    GRANT EXECUTE ON FUNCTION sponsor_reach_prune() TO ad_worker;
  END IF;
END
$$;
