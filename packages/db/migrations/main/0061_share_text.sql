-- L15b: an editor can word the share card of a video or series (share title and share description). Null means
-- the card uses the title and description. Additive, so a rollback to the previous release never reads the columns.
ALTER TABLE videos ADD COLUMN share_title text;--> statement-breakpoint
ALTER TABLE videos ADD COLUMN share_description text;--> statement-breakpoint
ALTER TABLE series ADD COLUMN share_title text;--> statement-breakpoint
ALTER TABLE series ADD COLUMN share_description text;--> statement-breakpoint
ALTER TABLE videos ADD CONSTRAINT videos_share_text_length CHECK (char_length(share_title) <= 90 AND char_length(share_description) <= 200);--> statement-breakpoint
ALTER TABLE series ADD CONSTRAINT series_share_text_length CHECK (char_length(share_title) <= 90 AND char_length(share_description) <= 200);
