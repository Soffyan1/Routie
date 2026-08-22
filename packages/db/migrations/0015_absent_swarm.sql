ALTER TABLE "content_concepts" ADD COLUMN "generation_mode" text DEFAULT 'AUTOMATIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_concepts" ADD COLUMN "visual_prompt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_concepts" ADD COLUMN "reference_asset_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;