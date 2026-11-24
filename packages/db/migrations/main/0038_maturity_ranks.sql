ALTER TABLE "series" ADD COLUMN "maturity_rank" smallint;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "maturity_rank" smallint;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "max_maturity_rank" smallint DEFAULT 4 NOT NULL;--> statement-breakpoint
UPDATE "profiles" SET "max_maturity_rank" = 0 WHERE "is_kids";--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_maturity_rank_range" CHECK ("series"."maturity_rank" IS NULL OR "series"."maturity_rank" BETWEEN 0 AND 4);--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_maturity_rank_range" CHECK ("videos"."maturity_rank" IS NULL OR "videos"."maturity_rank" BETWEEN 0 AND 4);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_max_maturity_range" CHECK ("profiles"."max_maturity_rank" BETWEEN 0 AND 4);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_kids_lowest_maturity" CHECK (NOT "profiles"."is_kids" OR "profiles"."max_maturity_rank" = 0);--> statement-breakpoint
UPDATE "videos" SET "maturity_rank" = CASE WHEN "kids_safe" THEN 0 WHEN "suitability" = 'older' THEN 3 ELSE 2 END WHERE "maturity_rank" IS NULL;--> statement-breakpoint
UPDATE "series" SET "maturity_rank" = CASE WHEN "kids_safe" THEN 0 ELSE 2 END WHERE "maturity_rank" IS NULL;--> statement-breakpoint
CREATE FUNCTION "sync_kids_safe_from_rank"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."maturity_rank" IS NOT NULL THEN
    NEW."kids_safe" := (NEW."maturity_rank" = 0);
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "videos_sync_kids_safe" BEFORE INSERT OR UPDATE OF "maturity_rank", "kids_safe" ON "videos" FOR EACH ROW EXECUTE FUNCTION "sync_kids_safe_from_rank"();--> statement-breakpoint
CREATE TRIGGER "series_sync_kids_safe" BEFORE INSERT OR UPDATE OF "maturity_rank", "kids_safe" ON "series" FOR EACH ROW EXECUTE FUNCTION "sync_kids_safe_from_rank"();
--> statement-breakpoint
CREATE FUNCTION "profiles_kids_lowest_rank"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."is_kids" THEN
    NEW."max_maturity_rank" := 0;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "profiles_kids_lowest_rank" BEFORE INSERT OR UPDATE OF "is_kids", "max_maturity_rank" ON "profiles" FOR EACH ROW EXECUTE FUNCTION "profiles_kids_lowest_rank"();
