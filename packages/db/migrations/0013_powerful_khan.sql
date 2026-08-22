CREATE TYPE "public"."publication_mode" AS ENUM('SAFE', 'AUTOMATIC');--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "publication_mode" "publication_mode" DEFAULT 'SAFE' NOT NULL;