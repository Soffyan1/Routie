import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector
} from "drizzle-orm/pg-core";
import {
  contentStates,
  deliveryModes,
  entitlementStatuses,
  providerCapabilities,
  socialChannels,
  publicationModes,
  workspaceRoles,
  type ResearchSource
} from "@routie/domain";

export const workspaceRoleEnum = pgEnum("workspace_role", workspaceRoles);
export const providerCapabilityEnum = pgEnum("provider_capability", providerCapabilities);
export const socialChannelEnum = pgEnum("social_channel", socialChannels);
export const deliveryModeEnum = pgEnum("delivery_mode", deliveryModes);
export const publicationModeEnum = pgEnum("publication_mode", publicationModes);
export const entitlementStatusEnum = pgEnum("entitlement_status", entitlementStatuses);
export const contentStateEnum = pgEnum("content_state", contentStates);
export const providerEnum = pgEnum("ai_provider", ["OPENAI", "GEMINI", "ANTHROPIC", "ZARK"]);
export const contentKindEnum = pgEnum("content_kind", ["TEXT", "IMAGE", "CAROUSEL", "SHORT_VIDEO", "STORY"]);
export const mediaKindEnum = pgEnum("media_kind", ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "LOGO", "FONT"]);
export const jobStatusEnum = pgEnum("job_status", ["QUEUED", "PROCESSING", "SUCCEEDED", "FAILED", "HELD", "CANCELED"]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "APPROVAL_REQUIRED",
  "PUBLISH_FAILED",
  "TOKEN_EXPIRED",
  "ENTITLEMENT_CHANGED",
  "EXPORT_READY"
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalCustomerId: text("external_customer_id"),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [uniqueIndex("users_external_customer_unique").on(table.externalCustomerId)]
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalCustomerId: text("external_customer_id").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    language: text("language").notNull().default("id-ID"),
    publicationMode: publicationModeEnum("publication_mode").notNull().default("SAFE"),
    maxConceptsPerDay: integer("max_concepts_per_day").notNull().default(3),
    maxMembers: integer("max_members").notNull().default(5),
    maxStorageBytes: bigint("max_storage_bytes", { mode: "number" }).notNull().default(20 * 1024 ** 3),
    storageUsedBytes: bigint("storage_used_bytes", { mode: "number" }).notNull().default(0),
    ...timestamps
  },
  (table) => [uniqueIndex("workspaces_external_customer_unique").on(table.externalCustomerId)]
);

export const memberships = pgTable(
  "memberships",
  {
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] }), index("memberships_user_idx").on(table.userId)]
);

export const entitlements = pgTable(
  "entitlements",
  {
    workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
    status: entitlementStatusEnum("status").notNull().default("ACTIVE"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
    purgeAt: timestamp("purge_at", { withTimezone: true }),
    sourceVersion: text("source_version"),
    ...timestamps
  }
);

export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().unique().references(() => workspaces.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull(),
  tagline: text("tagline").notNull().default(""),
  brief: text("brief").notNull().default(""),
  brandPersona: text("brand_persona").notNull().default(""),
  niche: text("niche").notNull().default(""),
  websiteUrl: text("website_url").notNull().default(""),
  targetAudience: text("target_audience").notNull().default(""),
  targetAgeMin: integer("target_age_min").notNull().default(18),
  targetAgeMax: integer("target_age_max").notNull().default(45),
  targetGender: text("target_gender").notNull().default("ALL"),
  targetLocations: text("target_locations").array().notNull().default(sql`'{}'::text[]`),
  tone: text("tone").notNull().default(""),
  prohibitedClaims: text("prohibited_claims").array().notNull().default(sql`'{}'::text[]`),
  callsToAction: text("calls_to_action").array().notNull().default(sql`'{}'::text[]`),
  contentPillars: jsonb("content_pillars").$type<Array<{ name: string; percentage: number }>>().notNull().default([]),
  colors: text("colors").array().notNull().default(sql`'{}'::text[]`),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  ...timestamps
});

export const brandSources = pgTable(
  "brand_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    sourceUrl: text("source_url"),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding", { dimensions: 384 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [index("brand_sources_workspace_idx").on(table.workspaceId), index("brand_sources_search_idx").using("gin", sql`to_tsvector('simple', ${table.content})`)]
);

export const brandAssets = pgTable(
  "brand_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: mediaKindEnum("kind").notNull(),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksum: text("checksum").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (table) => [index("brand_assets_workspace_idx").on(table.workspaceId), uniqueIndex("brand_assets_object_key_unique").on(table.objectKey)]
);

/** A reusable product catalogue for the Product Poster Studio. */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    benefits: text("benefits").array().notNull().default(sql`'{}'::text[]`),
    priceText: text("price_text").notNull().default(""),
    callToAction: text("call_to_action").notNull().default(""),
    destinationUrl: text("destination_url").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [index("products_workspace_idx").on(table.workspaceId, table.archivedAt)]
);

export const productAssets = pgTable(
  "product_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    brandAssetId: uuid("brand_asset_id").notNull().references(() => brandAssets.id, { onDelete: "restrict" }),
    role: text("role").notNull().default("PRODUCT_ALTERNATIVE"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps
  },
  (table) => [
    index("product_assets_product_idx").on(table.productId, table.sortOrder),
    uniqueIndex("product_assets_product_brand_asset_unique").on(table.productId, table.brandAssetId)
  ]
);

export const providerCredentials = pgTable(
  "provider_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    capability: providerCapabilityEnum("capability").notNull(),
    model: text("model").notNull(),
    encryptedSecret: text("encrypted_secret").notNull(),
    secretLastFour: text("secret_last_four").notNull(),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    uniqueIndex("provider_credentials_workspace_provider_capability_unique").on(
      table.workspaceId,
      table.provider,
      table.capability
    ),
    uniqueIndex("provider_credentials_workspace_active_capability_unique")
      .on(table.workspaceId, table.capability)
      .where(sql`${table.disabledAt} is null`),
    index("provider_credentials_workspace_idx").on(table.workspaceId)
  ]
);

export const socialConnections = pgTable(
  "social_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    channel: socialChannelEnum("channel").notNull(),
    deliveryMode: deliveryModeEnum("delivery_mode").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    accountName: text("account_name").notNull(),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    reauthorizationRequiredAt: timestamp("reauthorization_required_at", { withTimezone: true }),
    reauthorizationReason: text("reauthorization_reason"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [uniqueIndex("social_connection_account_unique").on(table.workspaceId, table.channel, table.externalAccountId)]
);

export const contentCalendars = pgTable(
  "content_calendars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    conceptsPerDay: integer("concepts_per_day").notNull(),
    timezone: text("timezone").notNull(),
    postingTimes: text("posting_times").array().notNull(),
    channels: socialChannelEnum("channels").array().notNull(),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    ...timestamps
  },
  (table) => [uniqueIndex("content_calendars_month_unique").on(table.workspaceId, table.year, table.month)]
);

export const calendarSlots = pgTable(
  "calendar_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    calendarId: uuid("calendar_id").notNull().references(() => contentCalendars.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    localDate: text("local_date").notNull(),
    localTime: text("local_time").notNull(),
    timezone: text("timezone").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    ...timestamps
  },
  (table) => [uniqueIndex("calendar_slots_sequence_unique").on(table.calendarId, table.sequence), index("calendar_slots_due_idx").on(table.scheduledFor)]
);

export const contentConcepts = pgTable(
  "content_concepts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    slotId: uuid("slot_id").notNull().unique().references(() => calendarSlots.id, { onDelete: "cascade" }),
    state: contentStateEnum("state").notNull().default("IDEA_DRAFT"),
    topic: text("topic").notNull().default(""),
    hook: text("hook").notNull().default(""),
    outline: text("outline").notNull().default(""),
    initialCaption: text("initial_caption").notNull().default(""),
    contentPillar: text("content_pillar"),
    hashtags: text("hashtags").array().notNull().default(sql`'{}'::text[]`),
    creationMode: text("creation_mode").notNull().default("AI"),
    generationMode: text("generation_mode").notNull().default("AUTOMATIC"),
    visualPrompt: text("visual_prompt").notNull().default(""),
    referenceAssetIds: uuid("reference_asset_ids").array().notNull().default(sql`'{}'::uuid[]`),
    recommendedKind: contentKindEnum("recommended_kind"),
    version: integer("version").notNull().default(1),
    heldReason: text("held_reason"),
    ...timestamps
  },
  (table) => [index("content_concepts_workspace_state_idx").on(table.workspaceId, table.state)]
);

export const creativeBriefs = pgTable(
  "creative_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id").notNull().unique().references(() => contentConcepts.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    mode: text("mode").notNull(),
    recipeCode: text("recipe_code").notNull(),
    recipeVersion: integer("recipe_version").notNull().default(1),
    headline: text("headline").notNull().default(""),
    subheadline: text("subheadline").notNull().default(""),
    offerText: text("offer_text").notNull().default(""),
    callToAction: text("call_to_action").notNull().default(""),
    visualStyle: text("visual_style").notNull().default(""),
    aspectRatio: text("aspect_ratio").notNull().default("1:1"),
    status: text("status").notNull().default("DRAFT"),
    ...timestamps
  },
  (table) => [index("creative_briefs_workspace_status_idx").on(table.workspaceId, table.status)]
);

export const generationRuns = pgTable(
  "generation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    creativeBriefId: uuid("creative_brief_id").notNull().references(() => creativeBriefs.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull().default(1),
    provider: providerEnum("provider"),
    model: text("model"),
    status: text("status").notNull().default("QUEUED"),
    idempotencyKey: text("idempotency_key").notNull(),
    promptVersion: integer("prompt_version").notNull().default(1),
    inputAssetIds: text("input_asset_ids").array().notNull().default(sql`'{}'::text[]`),
    outputAssetIds: text("output_asset_ids").array().notNull().default(sql`'{}'::text[]`),
    usage: jsonb("usage").$type<Record<string, unknown>>().notNull().default({}),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    uniqueIndex("generation_runs_idempotency_unique").on(table.idempotencyKey),
    index("generation_runs_brief_idx").on(table.creativeBriefId, table.createdAt)
  ]
);

export const conceptResearchSources = pgTable(
  "concept_research_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id").notNull().references(() => contentConcepts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    accessedAt: timestamp("accessed_at", { withTimezone: true }).notNull(),
    raw: jsonb("raw").$type<ResearchSource>(),
    ...timestamps
  },
  (table) => [index("concept_sources_concept_idx").on(table.conceptId)]
);

export const channelVariants = pgTable(
  "channel_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id").notNull().references(() => contentConcepts.id, { onDelete: "cascade" }),
    channel: socialChannelEnum("channel").notNull(),
    deliveryMode: deliveryModeEnum("delivery_mode").notNull(),
    contentKind: contentKindEnum("content_kind").notNull(),
    caption: text("caption").notNull().default(""),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    version: integer("version").notNull().default(1),
    ...timestamps
  },
  (table) => [uniqueIndex("channel_variants_concept_channel_unique").on(table.conceptId, table.channel)]
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => channelVariants.id, { onDelete: "cascade" }),
    kind: mediaKindEnum("kind").notNull(),
    source: text("source").notNull(),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    checksum: text("checksum").notNull(),
    generationMetadata: jsonb("generation_metadata").$type<Record<string, unknown>>().notNull().default({}),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [index("media_assets_variant_idx").on(table.variantId)]
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id").notNull().references(() => contentConcepts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => channelVariants.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason"),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    entityVersion: integer("entity_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("approvals_concept_idx").on(table.conceptId)]
);

export const publishJobs = pgTable(
  "publish_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull().references(() => channelVariants.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => socialConnections.id, { onDelete: "set null" }),
    status: jobStatusEnum("status").notNull().default("QUEUED"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    externalPostId: text("external_post_id"),
    externalUrl: text("external_url"),
    providerJobId: text("provider_job_id"),
    lastError: jsonb("last_error").$type<Record<string, unknown>>(),
    heldReason: text("held_reason"),
    ...timestamps
  },
  (table) => [uniqueIndex("publish_jobs_idempotency_unique").on(table.idempotencyKey), index("publish_jobs_due_idx").on(table.status, table.scheduledFor)]
);

export const publishAttempts = pgTable(
  "publish_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => publishJobs.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    outcome: text("outcome"),
    providerRequestId: text("provider_request_id"),
    sanitizedResponse: jsonb("sanitized_response").$type<Record<string, unknown>>()
  },
  (table) => [uniqueIndex("publish_attempt_number_unique").on(table.jobId, table.attemptNumber)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionUrl: text("action_url"),
    readAt: timestamp("read_at", { withTimezone: true }),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("notifications_user_idx").on(table.userId, table.readAt)]
);

export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    role: workspaceRoleEnum("role").notNull(),
    purpose: text("purpose").notNull().default("LOGIN"),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("magic_links_token_unique").on(table.tokenHash), index("magic_links_email_idx").on(table.email)]
);

export const webhookEvents = pgTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  source: text("source").notNull(),
  eventType: text("event_type").notNull(),
  payloadHash: text("payload_hash").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow()
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("audit_events_workspace_idx").on(table.workspaceId, table.createdAt)]
);

export const socialPostInsights = pgTable(
  "social_post_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id").references(() => contentConcepts.id, { onDelete: "set null" }),
    channel: socialChannelEnum("channel").notNull(),
    externalPostId: text("external_post_id").notNull(),
    postUrl: text("post_url"),
    postTitle: text("post_title").notNull(),
    postCaption: text("post_caption"),
    mediaType: text("media_type").notNull().default("IMAGE"),
    mediaUrl: text("media_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    viewsCount: integer("views_count").notNull().default(0),
    reachCount: integer("reach_count").notNull().default(0),
    impressionsCount: integer("impressions_count").notNull().default(0),
    likesCount: integer("likes_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    sharesCount: integer("shares_count").notNull().default(0),
    savesCount: integer("saves_count").notNull().default(0),
    engagementRate: integer("engagement_rate").notNull().default(0), // stored as basis points (e.g. 485 = 4.85%)
    performanceScore: text("performance_score").default("NORMAL"), // "VIRAL", "HIGH", "NORMAL", "LOW"
    metricsRaw: jsonb("metrics_raw").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (table) => [
    uniqueIndex("social_post_insights_account_post_unique").on(table.workspaceId, table.channel, table.externalPostId),
    index("social_post_insights_workspace_published_idx").on(table.workspaceId, table.publishedAt),
    index("social_post_insights_concept_idx").on(table.conceptId)
  ]
);

export const dailyWorkspaceMetrics = pgTable(
  "daily_workspace_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    channel: text("channel").notNull().default("ALL"), // "ALL", "INSTAGRAM", "FACEBOOK", "TIKTOK"
    totalFollowers: integer("total_followers").notNull().default(0),
    newFollowers: integer("new_followers").notNull().default(0),
    totalReach: integer("total_reach").notNull().default(0),
    totalImpressions: integer("total_impressions").notNull().default(0),
    totalEngagements: integer("total_engagements").notNull().default(0),
    profileViews: integer("profile_views").notNull().default(0),
    websiteClicks: integer("website_clicks").notNull().default(0),
    ...timestamps
  },
  (table) => [
    uniqueIndex("daily_workspace_metrics_unique").on(table.workspaceId, table.channel, table.date),
    index("daily_workspace_metrics_workspace_date_idx").on(table.workspaceId, table.date)
  ]
);

export const contentTemplates = pgTable(
  "content_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "CAPTION" | "HASHTAG" | "CTA" | "PROMPT"
    channel: text("channel").default("ALL"), // "ALL" or SocialChannel
    name: text("name").notNull(),
    body: text("body").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    isPreset: boolean("is_preset").notNull().default(false),
    ...timestamps
  },
  (table) => [index("content_templates_workspace_kind_idx").on(table.workspaceId, table.kind)]
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    approvalRequired: boolean("approval_required").notNull().default(true),
    publishFailed: boolean("publish_failed").notNull().default(true),
    tokenExpired: boolean("token_expired").notNull().default(true),
    weeklyDigest: boolean("weekly_digest").notNull().default(true),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    inAppNotifications: boolean("in_app_notifications").notNull().default(true),
    ...timestamps
  },
  (table) => [uniqueIndex("notification_preferences_user_ws_unique").on(table.workspaceId, table.userId)]
);

export type Workspace = typeof workspaces.$inferSelect;
export type ContentConcept = typeof contentConcepts.$inferSelect;
export type ChannelVariant = typeof channelVariants.$inferSelect;
export type PublishJob = typeof publishJobs.$inferSelect;
export type SocialPostInsightEntity = typeof socialPostInsights.$inferSelect;
export type DailyWorkspaceMetricEntity = typeof dailyWorkspaceMetrics.$inferSelect;
export type ContentTemplateEntity = typeof contentTemplates.$inferSelect;
export type NotificationPreferenceEntity = typeof notificationPreferences.$inferSelect;
