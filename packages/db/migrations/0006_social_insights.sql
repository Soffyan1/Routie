CREATE TABLE IF NOT EXISTS "social_post_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"concept_id" uuid,
	"channel" "social_channel" NOT NULL,
	"external_post_id" text NOT NULL,
	"post_url" text,
	"post_title" text NOT NULL,
	"post_caption" text,
	"media_type" text DEFAULT 'IMAGE' NOT NULL,
	"media_url" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"reach_count" integer DEFAULT 0 NOT NULL,
	"impressions_count" integer DEFAULT 0 NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"shares_count" integer DEFAULT 0 NOT NULL,
	"saves_count" integer DEFAULT 0 NOT NULL,
	"engagement_rate" integer DEFAULT 0 NOT NULL,
	"performance_score" text DEFAULT 'NORMAL',
	"metrics_raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_workspace_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"date" text NOT NULL,
	"channel" text DEFAULT 'ALL' NOT NULL,
	"total_followers" integer DEFAULT 0 NOT NULL,
	"new_followers" integer DEFAULT 0 NOT NULL,
	"total_reach" integer DEFAULT 0 NOT NULL,
	"total_impressions" integer DEFAULT 0 NOT NULL,
	"total_engagements" integer DEFAULT 0 NOT NULL,
	"profile_views" integer DEFAULT 0 NOT NULL,
	"website_clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_post_insights" ADD CONSTRAINT "social_post_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "social_post_insights" ADD CONSTRAINT "social_post_insights_concept_id_content_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "content_concepts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_workspace_metrics" ADD CONSTRAINT "daily_workspace_metrics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_post_insights_account_post_unique" ON "social_post_insights" USING btree ("workspace_id","channel","external_post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_post_insights_workspace_published_idx" ON "social_post_insights" USING btree ("workspace_id","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_post_insights_concept_idx" ON "social_post_insights" USING btree ("concept_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_workspace_metrics_unique" ON "daily_workspace_metrics" USING btree ("workspace_id","channel","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_workspace_metrics_workspace_date_idx" ON "daily_workspace_metrics" USING btree ("workspace_id","date");
--> statement-breakpoint
ALTER TABLE "social_post_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "social_post_insights" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "social_post_insights"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "daily_workspace_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_workspace_metrics" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "daily_workspace_metrics"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
