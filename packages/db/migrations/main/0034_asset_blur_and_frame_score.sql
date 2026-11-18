ALTER TABLE "assets" ADD COLUMN "placeholder_blur" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "candidate_score" smallint;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_score_range" CHECK ("assets"."candidate_score" IS NULL OR ("assets"."candidate_score" >= 0 AND "assets"."candidate_score" <= 100));--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_blur_small" CHECK ("assets"."placeholder_blur" IS NULL OR length("assets"."placeholder_blur") < 1024);