ALTER TYPE "public"."account_status" ADD VALUE 'pending_deletion' BEFORE 'deleted';--> statement-breakpoint
ALTER TABLE "account_deletions" ADD COLUMN "purge_after" timestamp with time zone;