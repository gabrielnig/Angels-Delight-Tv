CREATE TABLE "search_history" (
	"profile_id" uuid NOT NULL,
	"query" text NOT NULL,
	"searched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_history_profile_id_query_pk" PRIMARY KEY("profile_id","query"),
	CONSTRAINT "search_history_query_length" CHECK (char_length("search_history"."query") BETWEEN 2 AND 80)
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"old_slug" text NOT NULL,
	"video_id" uuid,
	"series_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slug_redirects_slug_format" CHECK (old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(old_slug) BETWEEN 3 AND 120),
	CONSTRAINT "slug_redirects_exactly_one_target" CHECK (num_nonnulls("slug_redirects"."video_id", "slug_redirects"."series_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_history_recent_idx" ON "search_history" USING btree ("profile_id","searched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "slug_redirects_video_slug_uniq" ON "slug_redirects" USING btree ("old_slug") WHERE "slug_redirects"."video_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "slug_redirects_series_slug_uniq" ON "slug_redirects" USING btree ("old_slug") WHERE "slug_redirects"."series_id" IS NOT NULL;