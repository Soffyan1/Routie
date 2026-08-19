CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "vector";--> statement-breakpoint
CREATE TYPE "public"."content_kind" AS ENUM('TEXT', 'IMAGE', 'CAROUSEL', 'SHORT_VIDEO', 'STORY');--> statement-breakpoint
CREATE TYPE "public"."content_state" AS ENUM('IDEA_DRAFT', 'IDEA_REVIEW', 'IDEA_APPROVED', 'GENERATING', 'FINAL_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'REJECTED', 'HELD', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."delivery_mode" AS ENUM('AUTO_PUBLISH', 'PLATFORM_DRAFT', 'EXPORT_MANUAL');--> statement-breakpoint
CREATE TYPE "public"."entitlement_status" AS ENUM('ACTIVE', 'GRACE', 'BLOCKED', 'PURGE_PENDING');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'HELD', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LOGO', 'FONT');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('APPROVAL_REQUIRED', 'PUBLISH_FAILED', 'TOKEN_EXPIRED', 'ENTITLEMENT_CHANGED', 'EXPORT_READY');--> statement-breakpoint
CREATE TYPE "public"."provider_capability" AS ENUM('TEXT', 'WEB_SEARCH', 'IMAGE', 'VIDEO', 'TTS');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('OPENAI', 'GEMINI', 'ANTHROPIC');--> statement-breakpoint
CREATE TYPE "public"."social_channel" AS ENUM('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'THREADS', 'YOUTUBE', 'X');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('OWNER', 'EDITOR', 'APPROVER');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"variant_id" uuid,
	"stage" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"actor_id" uuid NOT NULL,
	"entity_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"business_name" text NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"target_audience" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"prohibited_claims" text[] DEFAULT '{}'::text[] NOT NULL,
	"calls_to_action" text[] DEFAULT '{}'::text[] NOT NULL,
	"content_pillars" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"colors" text[] DEFAULT '{}'::text[] NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_profiles_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "brand_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"source_url" text,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(384),
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"local_date" text NOT NULL,
	"local_time" text NOT NULL,
	"timezone" text NOT NULL,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"channel" "social_channel" NOT NULL,
	"delivery_mode" "delivery_mode" NOT NULL,
	"content_kind" "content_kind" NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_research_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"accessed_at" timestamp with time zone NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"concepts_per_day" integer NOT NULL,
	"timezone" text NOT NULL,
	"posting_times" text[] NOT NULL,
	"channels" "social_channel"[] NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"state" "content_state" DEFAULT 'IDEA_DRAFT' NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"hook" text DEFAULT '' NOT NULL,
	"outline" text DEFAULT '' NOT NULL,
	"initial_caption" text DEFAULT '' NOT NULL,
	"content_pillar" text,
	"recommended_kind" "content_kind",
	"version" integer DEFAULT 1 NOT NULL,
	"held_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_concepts_slot_id_unique" UNIQUE("slot_id")
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"status" "entitlement_status" DEFAULT 'ACTIVE' NOT NULL,
	"current_period_end" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"grace_ends_at" timestamp with time zone,
	"purge_at" timestamp with time zone,
	"source_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"variant_id" uuid,
	"kind" "media_kind" NOT NULL,
	"source" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"checksum" text NOT NULL,
	"generation_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_url" text,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"capability" "provider_capability" NOT NULL,
	"model" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"secret_last_four" text NOT NULL,
	"validated_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"outcome" text,
	"provider_request_id" text,
	"sanitized_response" jsonb
);
--> statement-breakpoint
CREATE TABLE "publish_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"connection_id" uuid,
	"status" "job_status" DEFAULT 'QUEUED' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"external_post_id" text,
	"external_url" text,
	"last_error" jsonb,
	"held_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel" "social_channel" NOT NULL,
	"delivery_mode" "delivery_mode" NOT NULL,
	"external_account_id" text NOT NULL,
	"account_name" text NOT NULL,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_customer_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_customer_id" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"language" text DEFAULT 'id-ID' NOT NULL,
	"max_concepts_per_day" integer DEFAULT 3 NOT NULL,
	"max_members" integer DEFAULT 5 NOT NULL,
	"max_storage_bytes" bigint DEFAULT 21474836480 NOT NULL,
	"storage_used_bytes" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_concept_id_content_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."content_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_variant_id_channel_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."channel_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_sources" ADD CONSTRAINT "brand_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_calendar_id_content_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."content_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_variants" ADD CONSTRAINT "channel_variants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_variants" ADD CONSTRAINT "channel_variants_concept_id_content_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."content_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_variants" ADD CONSTRAINT "channel_variants_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_research_sources" ADD CONSTRAINT "concept_research_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_research_sources" ADD CONSTRAINT "concept_research_sources_concept_id_content_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."content_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_calendars" ADD CONSTRAINT "content_calendars_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_calendars" ADD CONSTRAINT "content_calendars_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_concepts" ADD CONSTRAINT "content_concepts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_concepts" ADD CONSTRAINT "content_concepts_slot_id_calendar_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."calendar_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_variant_id_channel_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."channel_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_attempts" ADD CONSTRAINT "publish_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_attempts" ADD CONSTRAINT "publish_attempts_job_id_publish_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."publish_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_variant_id_channel_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."channel_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_connection_id_social_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."social_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_concept_idx" ON "approvals" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "audit_events_workspace_idx" ON "audit_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "brand_assets_workspace_idx" ON "brand_assets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "brand_sources_workspace_idx" ON "brand_sources" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "brand_sources_search_idx" ON "brand_sources" USING gin (to_tsvector('simple', "content"));--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_slots_sequence_unique" ON "calendar_slots" USING btree ("calendar_id","sequence");--> statement-breakpoint
CREATE INDEX "calendar_slots_due_idx" ON "calendar_slots" USING btree ("scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_variants_concept_channel_unique" ON "channel_variants" USING btree ("concept_id","channel");--> statement-breakpoint
CREATE INDEX "concept_sources_concept_idx" ON "concept_research_sources" USING btree ("concept_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_calendars_month_unique" ON "content_calendars" USING btree ("workspace_id","year","month");--> statement-breakpoint
CREATE INDEX "content_concepts_workspace_state_idx" ON "content_concepts" USING btree ("workspace_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_links_token_unique" ON "magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "magic_links_email_idx" ON "magic_links" USING btree ("email");--> statement-breakpoint
CREATE INDEX "media_assets_variant_idx" ON "media_assets" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_credentials_workspace_capability_unique" ON "provider_credentials" USING btree ("workspace_id","capability");--> statement-breakpoint
CREATE INDEX "provider_credentials_workspace_idx" ON "provider_credentials" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publish_attempt_number_unique" ON "publish_attempts" USING btree ("job_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "publish_jobs_idempotency_unique" ON "publish_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "publish_jobs_due_idx" ON "publish_jobs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "social_connection_account_unique" ON "social_connections" USING btree ("workspace_id","channel","external_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_customer_unique" ON "users" USING btree ("external_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_external_customer_unique" ON "workspaces" USING btree ("external_customer_id");
