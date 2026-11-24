-- Two automatic row kinds for Home (M41, D-276). Own file: a new enum value cannot be used in the transaction that adds it.
ALTER TYPE "row_kind" ADD VALUE IF NOT EXISTS 'each_category';--> statement-breakpoint
ALTER TYPE "row_kind" ADD VALUE IF NOT EXISTS 'all_series';
