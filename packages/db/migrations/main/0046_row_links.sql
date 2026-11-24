-- Home sections get a slug, a View all setting and a minimum number of titles (M41-S06, M41-S08). Hero slides get text overrides (M41-S16).
ALTER TABLE "rows" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "rows" ADD COLUMN "view_all_mode" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "rows" ADD COLUMN "view_all_url" text;--> statement-breakpoint
ALTER TABLE "rows" ADD COLUMN "min_items" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rows" ADD CONSTRAINT "rows_view_all_mode" CHECK ("view_all_mode" IN ('auto', 'custom', 'none'));--> statement-breakpoint
ALTER TABLE "rows" ADD CONSTRAINT "rows_min_items_range" CHECK ("min_items" BETWEEN 1 AND 20);--> statement-breakpoint
ALTER TABLE "rows" ADD CONSTRAINT "rows_view_all_custom_has_url" CHECK ("view_all_mode" <> 'custom' OR ("view_all_url" IS NOT NULL AND char_length("view_all_url") <= 300 AND "view_all_url" !~ '[[:space:]\\]' AND ("view_all_url" ~ '^/[^/]' OR "view_all_url" ~ '^/$' OR "view_all_url" ~ '^https://[^/]'))) ;--> statement-breakpoint
CREATE UNIQUE INDEX "rows_slug_uniq" ON "rows" ("slug") WHERE "slug" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "row_items" ADD COLUMN "hero_headline" text;--> statement-breakpoint
ALTER TABLE "row_items" ADD COLUMN "hero_blurb" text;--> statement-breakpoint
ALTER TABLE "row_items" ADD COLUMN "hero_button_label" text;--> statement-breakpoint
ALTER TABLE "row_items" ADD CONSTRAINT "row_items_hero_text_length" CHECK (char_length(coalesce("hero_headline", '')) <= 80 AND char_length(coalesce("hero_blurb", '')) <= 80 AND char_length(coalesce("hero_button_label", '')) <= 80);--> statement-breakpoint
-- Existing Trending rows need four titles with views, like the new default (D-289).
UPDATE "rows" SET "min_items" = 4 WHERE "kind" = 'popular';--> statement-breakpoint
-- Slugs for existing manual rows, made unique with a number when titles repeat.
WITH base AS (
  SELECT id, position,
    coalesce(nullif(trim(both '-' from lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'row') AS stem
  FROM "rows" WHERE "kind" = 'curated' AND "series_id" IS NULL
), numbered AS (
  SELECT id, stem, row_number() OVER (PARTITION BY stem ORDER BY position) AS n FROM base
)
UPDATE "rows" r SET "slug" = CASE WHEN numbered.n = 1 THEN numbered.stem ELSE numbered.stem || '-' || numbered.n END
FROM numbered WHERE r.id = numbered.id;--> statement-breakpoint
-- The four list pages own these words under /browse, so a category cannot use them (D-290).
UPDATE "categories" SET "slug" = "slug" || '-videos' WHERE "slug" IN ('new', 'trending', 'series', 'row');--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_not_reserved" CHECK ("slug" NOT IN ('new', 'trending', 'series', 'row'));
