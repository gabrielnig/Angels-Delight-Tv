ALTER TABLE "assets" ADD COLUMN "cut_from" uuid;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "cut_focus" jsonb;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_cut_from_fk" FOREIGN KEY ("cut_from") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;