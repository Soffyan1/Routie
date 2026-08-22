ALTER TABLE "social_connections" ADD COLUMN IF NOT EXISTS "reauthorization_required_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "social_connections" ADD COLUMN IF NOT EXISTS "reauthorization_reason" text;
