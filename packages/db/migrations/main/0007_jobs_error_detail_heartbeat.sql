ALTER TABLE "jobs" ADD COLUMN "error_detail" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "heartbeat_at" timestamp with time zone;