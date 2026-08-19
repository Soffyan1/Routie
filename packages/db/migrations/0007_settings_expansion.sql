-- Migration: 0007_settings_expansion.sql
-- Add expanded brand profile fields
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "tagline" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "brand_persona" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "niche" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "website_url" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "target_age_min" integer DEFAULT 18 NOT NULL;
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "target_age_max" integer DEFAULT 45 NOT NULL;
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "target_gender" text DEFAULT 'ALL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "target_locations" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint

-- Create content_templates table
CREATE TABLE IF NOT EXISTS "content_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"channel" text DEFAULT 'ALL',
	"name" text NOT NULL,
	"body" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_preset" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"approval_required" boolean DEFAULT true NOT NULL,
	"publish_failed" boolean DEFAULT true NOT NULL,
	"token_expired" boolean DEFAULT true NOT NULL,
	"weekly_digest" boolean DEFAULT true NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"in_app_notifications" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Foreign key constraints
DO $$ BEGIN
 ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "content_templates_workspace_kind_idx" ON "content_templates" ("workspace_id", "kind");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_ws_unique" ON "notification_preferences" ("workspace_id", "user_id");
--> statement-breakpoint

-- RLS Enablement
ALTER TABLE "content_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$ BEGIN
 CREATE POLICY "content_templates_tenant_isolation" ON "content_templates"
  AS RESTRICTIVE
  USING ("workspace_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 CREATE POLICY "notification_preferences_tenant_isolation" ON "notification_preferences"
  AS RESTRICTIVE
  USING ("workspace_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
