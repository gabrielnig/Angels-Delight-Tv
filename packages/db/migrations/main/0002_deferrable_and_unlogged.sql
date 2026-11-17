ALTER TABLE "rate_limit_buckets" SET UNLOGGED;
--> statement-breakpoint
ALTER TABLE "rows" DROP CONSTRAINT "rows_position_uniq";
--> statement-breakpoint
ALTER TABLE "rows" ADD CONSTRAINT "rows_position_uniq" UNIQUE ("position") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "row_items" DROP CONSTRAINT "row_items_row_position_uniq";
--> statement-breakpoint
ALTER TABLE "row_items" ADD CONSTRAINT "row_items_row_position_uniq" UNIQUE ("row_id", "position") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "caption_tracks" ALTER CONSTRAINT "caption_tracks_approved_caption_id_captions_id_fk" DEFERRABLE INITIALLY DEFERRED;
