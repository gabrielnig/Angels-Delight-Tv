ALTER TABLE "videos" ADD COLUMN "captions_enabled" boolean;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "captions_off_reason" text;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_captions_off_has_reason" CHECK ("videos"."captions_enabled" IS DISTINCT FROM false OR coalesce(char_length("videos"."captions_off_reason"), 0) >= 5);