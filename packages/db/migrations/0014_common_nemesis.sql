CREATE TABLE "creative_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"product_id" uuid,
	"mode" text NOT NULL,
	"recipe_code" text NOT NULL,
	"recipe_version" integer DEFAULT 1 NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"subheadline" text DEFAULT '' NOT NULL,
	"offer_text" text DEFAULT '' NOT NULL,
	"call_to_action" text DEFAULT '' NOT NULL,
	"visual_style" text DEFAULT '' NOT NULL,
	"aspect_ratio" text DEFAULT '1:1' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creative_briefs_concept_id_unique" UNIQUE("concept_id")
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"creative_brief_id" uuid NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"provider" "ai_provider",
	"model" text,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"idempotency_key" text NOT NULL,
	"prompt_version" integer DEFAULT 1 NOT NULL,
	"input_asset_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"output_asset_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"brand_asset_id" uuid NOT NULL,
	"role" text DEFAULT 'PRODUCT_ALTERNATIVE' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"benefits" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_text" text DEFAULT '' NOT NULL,
	"call_to_action" text DEFAULT '' NOT NULL,
	"destination_url" text DEFAULT '' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_concept_id_content_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."content_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_creative_brief_id_creative_briefs_id_fk" FOREIGN KEY ("creative_brief_id") REFERENCES "public"."creative_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_assets" ADD CONSTRAINT "product_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_assets" ADD CONSTRAINT "product_assets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_assets" ADD CONSTRAINT "product_assets_brand_asset_id_brand_assets_id_fk" FOREIGN KEY ("brand_asset_id") REFERENCES "public"."brand_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creative_briefs_workspace_status_idx" ON "creative_briefs" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_runs_idempotency_unique" ON "generation_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "generation_runs_brief_idx" ON "generation_runs" USING btree ("creative_brief_id","created_at");--> statement-breakpoint
CREATE INDEX "product_assets_product_idx" ON "product_assets" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_assets_product_brand_asset_unique" ON "product_assets" USING btree ("product_id","brand_asset_id");--> statement-breakpoint
CREATE INDEX "products_workspace_idx" ON "products" USING btree ("workspace_id","archived_at");