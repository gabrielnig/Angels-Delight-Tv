-- Cues an aligned caption revision is unsure about, by start time in ms (M15-S02). Additive.
ALTER TABLE "captions" ADD COLUMN "low_confidence_cues" integer[] DEFAULT '{}'::integer[] NOT NULL;
