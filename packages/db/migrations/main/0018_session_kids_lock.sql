-- The kids lock lives on the session row, not in a client cookie (docs/SECURITY.md section 12). Additive.
ALTER TABLE "sessions" ADD COLUMN "active_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "kids_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_profile_id_profiles_id_fk" FOREIGN KEY ("active_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;