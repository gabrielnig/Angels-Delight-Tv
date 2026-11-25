-- M51: a series can word its groups and items on its own (Book and Chapter, Part and Lesson, custom words). The
-- site wide default lives in the settings table under content.series_labels. Null means the series follows the
-- site default. Additive, so a rollback to the previous release simply never reads the column.
ALTER TABLE series ADD COLUMN label_overrides jsonb;--> statement-breakpoint
ALTER TABLE series ADD CONSTRAINT series_label_overrides_object CHECK (label_overrides IS NULL OR jsonb_typeof(label_overrides) = 'object');
