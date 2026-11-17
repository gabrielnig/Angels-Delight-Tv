CREATE TYPE "public"."account_role" AS ENUM('viewer', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."asset_purpose" AS ENUM('logo', 'favicon', 'thumbnail', 'hero', 'series_art');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."caption_source" AS ENUM('whisper', 'aligned', 'manual', 'translation');--> statement-breakpoint
CREATE TYPE "public"."caption_status" AS ENUM('draft', 'in_review', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'failed_permanent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."publish_state" AS ENUM('draft', 'scheduled', 'published', 'unpublished');--> statement-breakpoint
CREATE TYPE "public"."rendition_status" AS ENUM('pending', 'encoding', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."row_kind" AS ENUM('hero', 'curated', 'category', 'recently_added', 'continue_watching', 'my_list', 'popular');--> statement-breakpoint
CREATE TYPE "public"."theme_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('verify_email', 'reset_password', 'change_email');--> statement-breakpoint
CREATE TYPE "public"."upload_kind" AS ENUM('video', 'image', 'caption');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('initiated', 'uploading', 'completing', 'completed', 'aborted', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."video_kind" AS ENUM('standalone', 'episode');--> statement-breakpoint
CREATE TYPE "public"."video_status" AS ENUM('uploading', 'uploaded', 'validating', 'encoding', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "my_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"video_id" uuid,
	"series_id" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "my_list_exactly_one_target" CHECK (num_nonnulls("my_list"."video_id", "my_list"."series_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "video_daily_stats" (
	"video_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"watch_ms" bigint DEFAULT 0 NOT NULL,
	"completions" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_daily_stats_video_id_day_pk" PRIMARY KEY("video_id","day")
);
--> statement-breakpoint
CREATE TABLE "view_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "view_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"play_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"profile_id" uuid,
	"audience" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"watched_ms" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"max_height" smallint,
	"country" char(2),
	CONSTRAINT "view_events_play_id_unique" UNIQUE("play_id"),
	CONSTRAINT "view_events_audience_known" CHECK ("view_events"."audience" IN ('general', 'kids')),
	CONSTRAINT "view_events_kids_anonymous" CHECK ("view_events"."audience" <> 'kids' OR "view_events"."profile_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "watch_progress" (
	"profile_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"position_ms" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_progress_profile_id_video_id_pk" PRIMARY KEY("profile_id","video_id"),
	CONSTRAINT "watch_progress_position_nonnegative" CHECK ("watch_progress"."position_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "caption_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"language" text NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"approved_caption_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caption_tracks_video_language_uniq" UNIQUE("video_id","language"),
	CONSTRAINT "caption_tracks_kind_known" CHECK ("caption_tracks"."kind" IN ('captions', 'subtitles')),
	CONSTRAINT "caption_tracks_label_length" CHECK (char_length("caption_tracks"."label") BETWEEN 1 AND 40)
);
--> statement-breakpoint
CREATE TABLE "captions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"source" "caption_source" NOT NULL,
	"status" "caption_status" DEFAULT 'draft' NOT NULL,
	"storage_key" text NOT NULL,
	"public_key" text,
	"sha256" "bytea" NOT NULL,
	"bytes" integer NOT NULL,
	"cue_count" integer NOT NULL,
	"model" text,
	"created_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "captions_track_revision_uniq" UNIQUE("track_id","revision"),
	CONSTRAINT "captions_revision_positive" CHECK ("captions"."revision" >= 1),
	CONSTRAINT "captions_size_limit" CHECK ("captions"."bytes" BETWEEN 0 AND 1048576),
	CONSTRAINT "captions_approved_is_reviewed" CHECK ("captions"."status" <> 'approved' OR ("captions"."reviewed_by" IS NOT NULL AND "captions"."public_key" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" "asset_purpose" NOT NULL,
	"status" "asset_status" DEFAULT 'processing' NOT NULL,
	"raw_key" text,
	"media_key_base" text,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"sha256" "bytea",
	"placeholder_color" text,
	"alt_text" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_mime_allowed" CHECK ("assets"."mime" IN ('image/webp', 'image/jpeg', 'image/png')),
	CONSTRAINT "assets_alt_text_length" CHECK ("assets"."alt_text" IS NULL OR char_length("assets"."alt_text") <= 200)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" "citext" NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_format" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 120),
	CONSTRAINT "categories_name_length" CHECK (char_length("categories"."name") BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"video_kind" "video_kind" DEFAULT 'episode' NOT NULL,
	"number" smallint NOT NULL,
	CONSTRAINT "episodes_video_id_unique" UNIQUE("video_id"),
	CONSTRAINT "episodes_season_number_uniq" UNIQUE("season_id","number"),
	CONSTRAINT "episodes_video_is_episode_kind" CHECK ("episodes"."video_kind" = 'episode'),
	CONSTRAINT "episodes_number_positive" CHECK ("episodes"."number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "renditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"height" smallint NOT NULL,
	"width" smallint NOT NULL,
	"video_kbps" integer NOT NULL,
	"audio_kbps" integer NOT NULL,
	"bandwidth_bps" integer,
	"avg_bandwidth_bps" integer,
	"codecs" text,
	"segment_count" integer,
	"segment_seconds" numeric(4, 2) DEFAULT '6.00' NOT NULL,
	"total_bytes" bigint,
	"template_key" text,
	"status" "rendition_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renditions_video_height_uniq" UNIQUE("video_id","height"),
	CONSTRAINT "renditions_height_range" CHECK ("renditions"."height" BETWEEN 144 AND 2160)
);
--> statement-breakpoint
CREATE TABLE "row_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"row_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"video_id" uuid,
	"series_id" uuid,
	CONSTRAINT "row_items_row_position_uniq" UNIQUE("row_id","position"),
	CONSTRAINT "row_items_exactly_one_target" CHECK (num_nonnulls("row_items"."video_id", "row_items"."series_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind" "row_kind" DEFAULT 'curated' NOT NULL,
	"category_id" uuid,
	"position" integer NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"kids_visible" boolean DEFAULT false NOT NULL,
	"max_items" smallint DEFAULT 20 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rows_position_uniq" UNIQUE("position"),
	CONSTRAINT "rows_title_length" CHECK (char_length("rows"."title") BETWEEN 1 AND 80),
	CONSTRAINT "rows_category_kind_has_category" CHECK ("rows"."kind" <> 'category' OR "rows"."category_id" IS NOT NULL),
	CONSTRAINT "rows_max_items_range" CHECK ("rows"."max_items" BETWEEN 1 AND 50)
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" uuid NOT NULL,
	"number" smallint NOT NULL,
	"title" text,
	CONSTRAINT "seasons_series_number_uniq" UNIQUE("series_id","number"),
	CONSTRAINT "seasons_number_positive" CHECK ("seasons"."number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kids_safe" boolean DEFAULT false NOT NULL,
	"poster_asset_id" uuid,
	"hero_asset_id" uuid,
	"publish_state" "publish_state" DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || coalesce(description, ''))) STORED,
	CONSTRAINT "series_slug_format" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 120),
	CONSTRAINT "series_title_length" CHECK (char_length("series"."title") BETWEEN 1 AND 200),
	CONSTRAINT "series_description_length" CHECK ("series"."description" IS NULL OR char_length("series"."description") <= 5000),
	CONSTRAINT "series_scheduled_has_time" CHECK ("series"."publish_state" <> 'scheduled' OR "series"."publish_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "series_categories" (
	"series_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "series_categories_series_id_category_id_pk" PRIMARY KEY("series_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "video_categories" (
	"video_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "video_categories_video_id_category_id_pk" PRIMARY KEY("video_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "video_keys" (
	"video_id" uuid PRIMARY KEY NOT NULL,
	"key_wrapped" "bytea" NOT NULL,
	"kek_version" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" "video_kind" DEFAULT 'standalone' NOT NULL,
	"status" "video_status" DEFAULT 'uploading' NOT NULL,
	"publish_state" "publish_state" DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"kids_safe" boolean DEFAULT false NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"duration_ms" integer,
	"width" smallint,
	"height" smallint,
	"original_key" text,
	"original_bytes" bigint,
	"original_sha256" "bytea",
	"media_prefix" text NOT NULL,
	"poster_asset_id" uuid,
	"hero_asset_id" uuid,
	"failure_code" text,
	"failure_message" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || coalesce(description, ''))) STORED,
	CONSTRAINT "videos_media_prefix_unique" UNIQUE("media_prefix"),
	CONSTRAINT "videos_id_kind_uniq" UNIQUE("id","kind"),
	CONSTRAINT "videos_slug_format" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 120),
	CONSTRAINT "videos_title_length" CHECK (char_length("videos"."title") BETWEEN 1 AND 200),
	CONSTRAINT "videos_description_length" CHECK ("videos"."description" IS NULL OR char_length("videos"."description") <= 5000),
	CONSTRAINT "videos_scheduled_has_time" CHECK ("videos"."publish_state" <> 'scheduled' OR "videos"."publish_at" IS NOT NULL),
	CONSTRAINT "videos_published_is_ready" CHECK ("videos"."publish_state" NOT IN ('scheduled', 'published') OR "videos"."status" = 'ready'),
	CONSTRAINT "videos_ready_has_duration" CHECK ("videos"."status" <> 'ready' OR ("videos"."duration_ms" IS NOT NULL AND "videos"."duration_ms" > 0))
);
--> statement-breakpoint
CREATE TABLE "account_deletions" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"main_data_purged_at" timestamp with time zone,
	"dek_destroyed_at" timestamp with time zone,
	"backups_clear_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" "bytea",
	"email_enc" "bytea",
	"display_name_enc" "bytea",
	"password_hash" text,
	"role" "account_role" DEFAULT 'viewer' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"locale" text DEFAULT 'en' NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "accounts_deleted_consistent" CHECK (("accounts"."status" = 'deleted') = ("accounts"."deleted_at" IS NOT NULL)),
	CONSTRAINT "accounts_live_has_credentials" CHECK ("accounts"."status" = 'deleted' OR ("accounts"."email_hash" IS NOT NULL AND "accounts"."email_enc" IS NOT NULL AND "accounts"."password_hash" IS NOT NULL)),
	CONSTRAINT "accounts_locale_length" CHECK (char_length("accounts"."locale") BETWEEN 2 AND 35)
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_trunc" text,
	CONSTRAINT "consents_kind_known" CHECK ("consents"."kind" IN ('terms', 'privacy', 'guardian_declaration'))
);
--> statement-breakpoint
CREATE TABLE "email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"new_email_enc" "bytea",
	"new_email_hash" "bytea",
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_trunc" text
);
--> statement-breakpoint
CREATE TABLE "mfa_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text DEFAULT 'totp' NOT NULL,
	"secret_enc" "bytea" NOT NULL,
	"confirmed_at" timestamp with time zone,
	"last_used_step" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mfa_factors_type_known" CHECK ("mfa_factors"."type" = 'totp')
);
--> statement-breakpoint
CREATE TABLE "mfa_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"code_hash" "bytea" NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name_enc" "bytea" NOT NULL,
	"avatar_id" text NOT NULL,
	"is_kids" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"pin_hash" text,
	"language" text DEFAULT 'en' NOT NULL,
	"autoplay_next" boolean DEFAULT true NOT NULL,
	"data_saver" boolean DEFAULT false NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_primary_not_kids" CHECK (NOT ("profiles"."is_primary" AND "profiles"."is_kids")),
	CONSTRAINT "profiles_position_range" CHECK ("profiles"."position" BETWEEN 0 AND 9)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"mfa_verified_at" timestamp with time zone,
	"reauth_at" timestamp with time zone,
	"ip_trunc" text,
	"user_agent" text,
	CONSTRAINT "sessions_user_agent_length" CHECK ("sessions"."user_agent" IS NULL OR char_length("sessions"."user_agent") <= 200)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue" text NOT NULL,
	"boss_job_id" uuid,
	"video_id" uuid,
	"asset_id" uuid,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"stage" text,
	"progress" smallint DEFAULT 0 NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_progress_range" CHECK ("jobs"."progress" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "upload_kind" NOT NULL,
	"video_id" uuid,
	"asset_id" uuid,
	"created_by" uuid NOT NULL,
	"filename" text NOT NULL,
	"declared_mime" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"part_size_bytes" integer NOT NULL,
	"total_parts" integer NOT NULL,
	"storage_key" text NOT NULL,
	"s3_upload_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"status" "upload_status" DEFAULT 'initiated' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "upload_sessions_filename_length" CHECK (char_length("upload_sessions"."filename") BETWEEN 1 AND 255),
	CONSTRAINT "upload_sessions_size_range" CHECK ("upload_sessions"."size_bytes" > 0 AND "upload_sessions"."size_bytes" <= 17179869184),
	CONSTRAINT "upload_sessions_part_size_min" CHECK ("upload_sessions"."part_size_bytes" >= 5242880),
	CONSTRAINT "upload_sessions_total_parts_range" CHECK ("upload_sessions"."total_parts" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_account_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"outcome" text NOT NULL,
	"ip_trunc" text,
	"request_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_log_outcome_known" CHECK ("audit_log"."outcome" IN ('success', 'denied', 'failure'))
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_format" CHECK ("settings"."key" ~ '^[a-z][a-z0-9_.]{1,63}$')
);
--> statement-breakpoint
CREATE TABLE "theme_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "theme_status" NOT NULL,
	"version" integer NOT NULL,
	"tokens" jsonb NOT NULL,
	"logo_asset_id" uuid,
	"favicon_asset_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "theme_settings_tokens_size" CHECK (pg_column_size("theme_settings"."tokens") < 16384)
);
--> statement-breakpoint
ALTER TABLE "my_list" ADD CONSTRAINT "my_list_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "my_list" ADD CONSTRAINT "my_list_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "my_list" ADD CONSTRAINT "my_list_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_daily_stats" ADD CONSTRAINT "video_daily_stats_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_events" ADD CONSTRAINT "view_events_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_events" ADD CONSTRAINT "view_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caption_tracks" ADD CONSTRAINT "caption_tracks_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caption_tracks" ADD CONSTRAINT "caption_tracks_approved_caption_id_captions_id_fk" FOREIGN KEY ("approved_caption_id") REFERENCES "public"."captions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_track_id_caption_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."caption_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_reviewed_by_accounts_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_video_kind_fk" FOREIGN KEY ("video_id","video_kind") REFERENCES "public"."videos"("id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renditions" ADD CONSTRAINT "renditions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "row_items" ADD CONSTRAINT "row_items_row_id_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "row_items" ADD CONSTRAINT "row_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "row_items" ADD CONSTRAINT "row_items_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rows" ADD CONSTRAINT "rows_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_poster_asset_id_assets_id_fk" FOREIGN KEY ("poster_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_hero_asset_id_assets_id_fk" FOREIGN KEY ("hero_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_categories" ADD CONSTRAINT "series_categories_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_categories" ADD CONSTRAINT "series_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_categories" ADD CONSTRAINT "video_categories_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_categories" ADD CONSTRAINT "video_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_keys" ADD CONSTRAINT "video_keys_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_poster_asset_id_assets_id_fk" FOREIGN KEY ("poster_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_hero_asset_id_assets_id_fk" FOREIGN KEY ("hero_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_accounts_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_settings" ADD CONSTRAINT "theme_settings_logo_asset_id_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_settings" ADD CONSTRAINT "theme_settings_favicon_asset_id_assets_id_fk" FOREIGN KEY ("favicon_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_settings" ADD CONSTRAINT "theme_settings_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "my_list_profile_video_uniq" ON "my_list" USING btree ("profile_id","video_id") WHERE "my_list"."video_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "my_list_profile_series_uniq" ON "my_list" USING btree ("profile_id","series_id") WHERE "my_list"."series_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "my_list_profile_added_idx" ON "my_list" USING btree ("profile_id","added_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "view_events_video_started_idx" ON "view_events" USING btree ("video_id","started_at");--> statement-breakpoint
CREATE INDEX "view_events_started_idx" ON "view_events" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "watch_progress_continue_idx" ON "watch_progress" USING btree ("profile_id","updated_at" DESC NULLS LAST) WHERE "watch_progress"."completed" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "caption_tracks_one_default_uniq" ON "caption_tracks" USING btree ("video_id") WHERE "caption_tracks"."is_default";--> statement-breakpoint
CREATE INDEX "captions_track_status_idx" ON "captions" USING btree ("track_id","status");--> statement-breakpoint
CREATE INDEX "assets_purpose_created_idx" ON "assets" USING btree ("purpose","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "assets_sha256_idx" ON "assets" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "categories_position_idx" ON "categories" USING btree ("position");--> statement-breakpoint
CREATE INDEX "episodes_season_number_idx" ON "episodes" USING btree ("season_id","number");--> statement-breakpoint
CREATE INDEX "renditions_video_idx" ON "renditions" USING btree ("video_id");--> statement-breakpoint
CREATE UNIQUE INDEX "row_items_row_video_uniq" ON "row_items" USING btree ("row_id","video_id") WHERE "row_items"."video_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "row_items_row_series_uniq" ON "row_items" USING btree ("row_id","series_id") WHERE "row_items"."series_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "row_items_row_position_idx" ON "row_items" USING btree ("row_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "series_slug_live_uniq" ON "series" USING btree ("slug") WHERE "series"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "series_publish_idx" ON "series" USING btree ("publish_state","published_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "series_search_idx" ON "series" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "series_title_trgm_idx" ON "series" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "series_categories_by_category_idx" ON "series_categories" USING btree ("category_id","series_id");--> statement-breakpoint
CREATE INDEX "video_categories_by_category_idx" ON "video_categories" USING btree ("category_id","video_id");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_slug_live_uniq" ON "videos" USING btree ("slug") WHERE "videos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "videos_publish_idx" ON "videos" USING btree ("publish_state","published_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "videos_search_idx" ON "videos" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "videos_title_trgm_idx" ON "videos" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "videos_processing_idx" ON "videos" USING btree ("status") WHERE "videos"."status" <> 'ready';--> statement-breakpoint
CREATE INDEX "videos_created_idx" ON "videos" USING btree ("created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "account_deletions_pending_idx" ON "account_deletions" USING btree ("dek_destroyed_at") WHERE "account_deletions"."dek_destroyed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_hash_uniq" ON "accounts" USING btree ("email_hash") WHERE "accounts"."email_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "accounts_staff_role_idx" ON "accounts" USING btree ("role") WHERE "accounts"."role" <> 'viewer';--> statement-breakpoint
CREATE INDEX "accounts_status_idx" ON "accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accounts_created_idx" ON "accounts" USING btree ("created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE UNIQUE INDEX "consents_account_kind_version_uniq" ON "consents" USING btree ("account_id","kind","version");--> statement-breakpoint
CREATE UNIQUE INDEX "email_tokens_token_hash_uniq" ON "email_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_tokens_unused_idx" ON "email_tokens" USING btree ("account_id","purpose") WHERE "email_tokens"."used_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_factors_account_type_uniq" ON "mfa_factors" USING btree ("account_id","type");--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_unused_idx" ON "mfa_recovery_codes" USING btree ("account_id") WHERE "mfa_recovery_codes"."used_at" IS NULL;--> statement-breakpoint
CREATE INDEX "profiles_account_position_idx" ON "profiles" USING btree ("account_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_one_primary_uniq" ON "profiles" USING btree ("account_id") WHERE "profiles"."is_primary";--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_updated_idx" ON "rate_limit_buckets" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uniq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_active_by_account_idx" ON "sessions" USING btree ("account_id") WHERE "sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sessions_absolute_expiry_idx" ON "sessions" USING btree ("absolute_expires_at");--> statement-breakpoint
CREATE INDEX "jobs_video_created_idx" ON "jobs" USING btree ("video_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_open_status_idx" ON "jobs" USING btree ("status","created_at") WHERE "jobs"."status" IN ('queued', 'running', 'failed');--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_one_open_per_video_queue_uniq" ON "jobs" USING btree ("queue","video_id") WHERE "jobs"."status" IN ('queued', 'running') AND "jobs"."video_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "upload_sessions_active_fingerprint_uniq" ON "upload_sessions" USING btree ("created_by","fingerprint") WHERE "upload_sessions"."status" IN ('initiated', 'uploading');--> statement-breakpoint
CREATE INDEX "upload_sessions_status_expiry_idx" ON "upload_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_idx" ON "audit_log" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_account_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "theme_settings_one_published_uniq" ON "theme_settings" USING btree ("status") WHERE "theme_settings"."status" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX "theme_settings_one_draft_uniq" ON "theme_settings" USING btree ("status") WHERE "theme_settings"."status" = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "theme_settings_version_uniq" ON "theme_settings" USING btree ("version");