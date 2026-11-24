-- A short muted preview clip per video for the Home hero (M41-S10). Additive: every video starts with none.
ALTER TABLE "videos" ADD COLUMN "preview_key" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "preview_state" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "preview_mode" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "preview_start_ms" integer;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "preview_bytes" integer;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "preview_note" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "preview_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_preview_state_known" CHECK ("preview_state" IN ('none', 'queued', 'ready', 'failed', 'skipped'));--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_preview_mode_known" CHECK ("preview_mode" IN ('auto', 'picked', 'off'));--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_preview_numbers" CHECK (("preview_start_ms" IS NULL OR "preview_start_ms" >= 0) AND ("preview_bytes" IS NULL OR "preview_bytes" >= 0));--> statement-breakpoint
-- The hourly sweep looks for published videos with no clip yet.
CREATE INDEX "videos_preview_sweep" ON "videos" ("updated_at") WHERE "preview_state" = 'none' AND "preview_mode" <> 'off' AND "deleted_at" IS NULL;
