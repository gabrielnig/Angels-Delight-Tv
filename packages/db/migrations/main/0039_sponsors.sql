ALTER TYPE "public"."asset_purpose" ADD VALUE 'sponsor';--> statement-breakpoint
CREATE TYPE "public"."sponsor_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sponsor_slot" AS ENUM('home_banner', 'title_card', 'player_after', 'player_before');--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "sponsor_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsors_name" CHECK (char_length("sponsors"."name") BETWEEN 1 AND 80),
	CONSTRAINT "sponsors_window" CHECK ("sponsors"."ends_at" IS NULL OR "sponsors"."starts_at" IS NULL OR "sponsors"."ends_at" > "sponsors"."starts_at")
);--> statement-breakpoint
CREATE TABLE "sponsor_private" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"contact_name_enc" bytea,
	"contact_email_enc" bytea,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_private_notes" CHECK ("sponsor_private"."notes" IS NULL OR char_length("sponsor_private"."notes") <= 1000)
);--> statement-breakpoint
CREATE TABLE "sponsor_creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"headline" text NOT NULL,
	"body" text,
	"cta_label" text DEFAULT 'Learn more' NOT NULL,
	"destination_url" text NOT NULL,
	"image_square_asset_id" uuid,
	"image_wide_asset_id" uuid,
	"alt_text" text,
	"weight" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_creatives_headline" CHECK (char_length("sponsor_creatives"."headline") BETWEEN 1 AND 60),
	CONSTRAINT "sponsor_creatives_body" CHECK ("sponsor_creatives"."body" IS NULL OR char_length("sponsor_creatives"."body") <= 140),
	CONSTRAINT "sponsor_creatives_cta" CHECK (char_length("sponsor_creatives"."cta_label") BETWEEN 1 AND 24),
	CONSTRAINT "sponsor_creatives_alt" CHECK ("sponsor_creatives"."alt_text" IS NULL OR char_length("sponsor_creatives"."alt_text") <= 120),
	CONSTRAINT "sponsor_creatives_weight" CHECK ("sponsor_creatives"."weight" BETWEEN 1 AND 10),
	CONSTRAINT "sponsor_creatives_destination" CHECK ("sponsor_creatives"."destination_url" ~ '^https://' AND char_length("sponsor_creatives"."destination_url") <= 500)
);--> statement-breakpoint
CREATE TABLE "sponsor_placements" (
	"creative_id" uuid NOT NULL,
	"slot" "sponsor_slot" NOT NULL,
	CONSTRAINT "sponsor_placements_creative_id_slot_pk" PRIMARY KEY("creative_id","slot")
);--> statement-breakpoint
CREATE TABLE "sponsor_daily_stats" (
	"day" date NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"creative_id" uuid NOT NULL,
	"slot" "sponsor_slot" NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sponsor_daily_stats_day_creative_id_slot_pk" PRIMARY KEY("day","creative_id","slot"),
	CONSTRAINT "sponsor_daily_stats_nonneg" CHECK ("sponsor_daily_stats"."impressions" >= 0 AND "sponsor_daily_stats"."clicks" >= 0 AND "sponsor_daily_stats"."reach" >= 0)
);--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_private" ADD CONSTRAINT "sponsor_private_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_creatives" ADD CONSTRAINT "sponsor_creatives_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_creatives" ADD CONSTRAINT "sponsor_creatives_image_square_asset_id_assets_id_fk" FOREIGN KEY ("image_square_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_creatives" ADD CONSTRAINT "sponsor_creatives_image_wide_asset_id_assets_id_fk" FOREIGN KEY ("image_wide_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_placements" ADD CONSTRAINT "sponsor_placements_creative_id_sponsor_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."sponsor_creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_daily_stats" ADD CONSTRAINT "sponsor_daily_stats_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sponsors_status_idx" ON "sponsors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sponsor_creatives_sponsor_idx" ON "sponsor_creatives" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "sponsor_daily_stats_sponsor_idx" ON "sponsor_daily_stats" USING btree ("sponsor_id","day");--> statement-breakpoint
CREATE TRIGGER sponsors_updated_at BEFORE UPDATE ON "sponsors" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER sponsor_creatives_updated_at BEFORE UPDATE ON "sponsor_creatives" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER sponsor_private_updated_at BEFORE UPDATE ON "sponsor_private" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
-- Same rule as sponsor_effective in packages/shared/src/sponsors.ts. The window is inclusive at both ends.
CREATE FUNCTION sponsor_effective(p_status sponsor_status, p_starts timestamptz, p_ends timestamptz, p_at timestamptz)
  RETURNS text
  LANGUAGE sql IMMUTABLE
  AS $$
    SELECT CASE
      WHEN p_status = 'draft' THEN 'draft'
      WHEN p_status = 'paused' THEN 'paused'
      WHEN p_status = 'archived' THEN 'archived'
      WHEN p_starts IS NOT NULL AND p_at < p_starts THEN 'scheduled'
      WHEN p_ends IS NOT NULL AND p_at > p_ends THEN 'ended'
      ELSE 'live'
    END
  $$;--> statement-breakpoint
CREATE VIEW sponsor_effective_status WITH (security_invoker = true) AS
  SELECT id AS sponsor_id, sponsor_effective(status, starts_at, ends_at, now()) AS effective_status FROM sponsors;--> statement-breakpoint
-- Staff are editors, admins and Super admins. Everyone else (guests, viewers, kids) reads only live rows.
CREATE FUNCTION app_is_sponsor_staff() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT coalesce(app_actor_role() IN ('editor', 'admin', 'super_admin'), false) $$;--> statement-breakpoint
-- The only write path for counters. SECURITY DEFINER so the web and worker roles need no table access at all.
CREATE FUNCTION sponsor_stats_bump(
  p_day date, p_sponsor uuid, p_creative uuid, p_slot sponsor_slot, p_impressions int, p_clicks int, p_reach int
) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    INSERT INTO sponsor_daily_stats (day, sponsor_id, creative_id, slot, impressions, clicks, reach)
    VALUES (p_day, p_sponsor, p_creative, p_slot, greatest(p_impressions, 0), greatest(p_clicks, 0), greatest(p_reach, 0))
    ON CONFLICT (day, creative_id, slot) DO UPDATE SET
      impressions = sponsor_daily_stats.impressions + excluded.impressions,
      clicks = sponsor_daily_stats.clicks + excluded.clicks,
      reach = sponsor_daily_stats.reach + excluded.reach
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION sponsor_stats_bump(date, uuid, uuid, sponsor_slot, int, int, int) FROM PUBLIC;--> statement-breakpoint
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsors FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsor_private ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsor_private FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsor_creatives ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsor_creatives FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsor_placements ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsor_placements FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsor_daily_stats ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sponsor_daily_stats FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sponsors_staff ON sponsors FOR ALL
  USING (app_is_sponsor_staff()) WITH CHECK (app_is_sponsor_staff());--> statement-breakpoint
CREATE POLICY sponsors_public_live ON sponsors FOR SELECT
  USING (sponsor_effective(status, starts_at, ends_at, now()) = 'live');--> statement-breakpoint
CREATE POLICY sponsor_private_staff ON sponsor_private FOR ALL
  USING (app_is_sponsor_staff()) WITH CHECK (app_is_sponsor_staff());--> statement-breakpoint
CREATE POLICY sponsor_creatives_staff ON sponsor_creatives FOR ALL
  USING (app_is_sponsor_staff()) WITH CHECK (app_is_sponsor_staff());--> statement-breakpoint
CREATE POLICY sponsor_creatives_public_live ON sponsor_creatives FOR SELECT
  USING (active AND EXISTS (SELECT 1 FROM sponsors s WHERE s.id = sponsor_id));--> statement-breakpoint
CREATE POLICY sponsor_placements_staff ON sponsor_placements FOR ALL
  USING (app_is_sponsor_staff()) WITH CHECK (app_is_sponsor_staff());--> statement-breakpoint
CREATE POLICY sponsor_placements_public_live ON sponsor_placements FOR SELECT
  USING (EXISTS (SELECT 1 FROM sponsor_creatives c WHERE c.id = creative_id));--> statement-breakpoint
CREATE POLICY sponsor_daily_stats_staff_read ON sponsor_daily_stats FOR SELECT
  USING (app_is_sponsor_staff());--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    -- The SECURITY DEFINER bump runs as the owner, and FORCE applies policies to the owner too.
    CREATE POLICY sponsor_daily_stats_definer ON sponsor_daily_stats TO ad_migrator USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON sponsors, sponsor_private, sponsor_creatives, sponsor_placements TO ad_app;
    GRANT SELECT ON sponsor_daily_stats, sponsor_effective_status TO ad_app;
    GRANT EXECUTE ON FUNCTION sponsor_stats_bump(date, uuid, uuid, sponsor_slot, int, int, int) TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT ON sponsors, sponsor_creatives, sponsor_placements, sponsor_effective_status TO ad_worker;
    GRANT EXECUTE ON FUNCTION sponsor_stats_bump(date, uuid, uuid, sponsor_slot, int, int, int) TO ad_worker;
  END IF;
END
$$;
