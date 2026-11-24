-- A Popular row can fall back to the newest titles under its own fallback title (M44-S08, M44-S10).
ALTER TABLE "rows" ADD COLUMN "fallback_to_newest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rows" ADD COLUMN "fallback_title" text;--> statement-breakpoint
ALTER TABLE "rows" ADD CONSTRAINT "rows_fallback_title_length" CHECK (char_length(coalesce("fallback_title", '')) <= 80);
