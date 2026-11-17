ALTER TABLE "videos" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "suitability" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "caption_override_reason" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "poster_focus" jsonb;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_suitability_known" CHECK ("videos"."suitability" IS NULL OR "videos"."suitability" IN ('everyone', 'kids', 'older'));--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_tags_count" CHECK (cardinality("videos"."tags") <= 10);