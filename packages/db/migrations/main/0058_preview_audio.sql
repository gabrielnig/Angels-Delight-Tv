-- Hero preview clips keep a low bitrate audio track and a recorded length (M41, D-352 and D-353). Additive.
-- Every clip made before this migration is silent and has no recorded length, so the defaults are false and null:
-- the viewer hides the sound button for them and assumes the old 6 second length. They are replaced when the
-- admin action "Generate previews for all videos" (or a Retry) cuts them again.
ALTER TABLE "videos" ADD COLUMN "preview_has_audio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "preview_length_ms" integer;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_preview_length" CHECK ("preview_length_ms" IS NULL OR "preview_length_ms" > 0);
