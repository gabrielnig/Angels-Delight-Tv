
CREATE TYPE "public"."ui_translation_status" AS ENUM('draft', 'in_review', 'approved');--> statement-breakpoint
CREATE TABLE "translation_usage" (
	"month" date NOT NULL,
	"provider" text NOT NULL,
	"chars" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "translation_usage_month_provider_pk" PRIMARY KEY("month","provider")
);
--> statement-breakpoint
CREATE TABLE "ui_missing_keys" (
	"locale" text NOT NULL,
	"key" text NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ui_missing_keys_locale_key_pk" PRIMARY KEY("locale","key")
);
--> statement-breakpoint
CREATE TABLE "ui_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale" text NOT NULL,
	"key" text NOT NULL,
	"text" jsonb NOT NULL,
	"status" "ui_translation_status" DEFAULT 'draft' NOT NULL,
	"source_hash" "bytea",
	"note" text,
	"updated_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ui_translations_locale_key_uniq" UNIQUE("locale","key"),
	CONSTRAINT "ui_translations_locale_known" CHECK ("ui_translations"."locale" IN ('en', 'yo', 'ig', 'ha', 'pcm')),
	CONSTRAINT "ui_translations_key_length" CHECK (char_length("ui_translations"."key") BETWEEN 3 AND 120)
);
--> statement-breakpoint
ALTER TABLE "caption_tracks" ADD COLUMN "published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "captions" ADD COLUMN "source_caption_id" uuid;--> statement-breakpoint
ALTER TABLE "captions" ADD COLUMN "source_sha256" "bytea";--> statement-breakpoint
ALTER TABLE "ui_translations" ADD CONSTRAINT "ui_translations_updated_by_accounts_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ui_translations" ADD CONSTRAINT "ui_translations_reviewed_by_accounts_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ui_translations_locale_status_idx" ON "ui_translations" USING btree ("locale","status");--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_source_caption_id_captions_id_fk" FOREIGN KEY ("source_caption_id") REFERENCES "public"."captions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_source_only_for_translation" CHECK ("captions"."source" = 'translation' OR "captions"."source_caption_id" IS NULL);
--> statement-breakpoint
-- Hand written part: row level security, the missing key function and grants (the 0005 loop ran before these tables).
ALTER TABLE "ui_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ui_missing_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Viewers (no actor role) read approved text only. Staff read and write everything.
CREATE POLICY ui_translations_public_read ON ui_translations FOR SELECT
  USING (status = 'approved');--> statement-breakpoint
CREATE POLICY ui_translations_staff ON ui_translations FOR ALL
  USING (app_actor_role() IN ('editor', 'admin', 'super_admin'))
  WITH CHECK (app_actor_role() IN ('editor', 'admin', 'super_admin'));--> statement-breakpoint
CREATE POLICY ui_missing_keys_staff_read ON ui_missing_keys FOR SELECT
  USING (app_actor_role() IN ('editor', 'admin', 'super_admin'));--> statement-breakpoint
CREATE POLICY ui_missing_keys_staff_delete ON ui_missing_keys FOR DELETE
  USING (app_actor_role() IN ('admin', 'super_admin'));--> statement-breakpoint
-- A viewer request records a hit without an account. The function owns the write, the table has no insert grant policy.
CREATE FUNCTION record_missing_key(p_locale text, p_key text, p_hits integer DEFAULT 1) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF p_locale NOT IN ('yo', 'ig', 'ha', 'pcm') OR char_length(p_key) NOT BETWEEN 3 AND 120 OR p_hits < 1 THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ui_missing_keys WHERE locale = p_locale AND key = p_key)
     AND (SELECT count(*) FROM ui_missing_keys WHERE locale = p_locale) >= 10000 THEN
    RETURN;
  END IF;
  INSERT INTO ui_missing_keys (locale, key, hits) VALUES (p_locale, p_key, p_hits)
  ON CONFLICT (locale, key) DO UPDATE
    SET hits = ui_missing_keys.hits + EXCLUDED.hits, last_seen = now();
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_missing_key(text, text, integer) FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ui_translations TO ad_app;
    GRANT SELECT, DELETE ON ui_missing_keys TO ad_app;
    GRANT SELECT, INSERT, UPDATE ON translation_usage TO ad_app;
    GRANT EXECUTE ON FUNCTION record_missing_key(text, text, integer) TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT, INSERT, UPDATE ON translation_usage TO ad_worker;
    GRANT SELECT ON ui_translations TO ad_worker;
  END IF;
END
$$;
