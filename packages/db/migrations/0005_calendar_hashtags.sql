ALTER TABLE "content_concepts" ADD COLUMN IF NOT EXISTS "hashtags" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "content_concepts" ADD COLUMN IF NOT EXISTS "creation_mode" text DEFAULT 'AI' NOT NULL;
