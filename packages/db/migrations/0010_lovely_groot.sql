ALTER TABLE "magic_links" ADD COLUMN "purpose" text DEFAULT 'LOGIN' NOT NULL;--> statement-breakpoint
ALTER TABLE "magic_links" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "magic_links" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;