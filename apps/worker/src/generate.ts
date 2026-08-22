import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import {
  auditEvents,
  brandProfiles,
  brandAssets,
  calendarSlots,
  channelVariants,
  conceptResearchSources,
  contentCalendars,
  contentConcepts,
  creativeBriefs,
  generationRuns,
  createDatabase,
  mediaAssets,
  productAssets,
  products,
  notifications,
  providerCredentials,
  publishJobs,
  socialConnections,
  workspaces
} from "@routie/db";
import { buildBrandContext, buildProductPosterPrompt, type DeliveryMode, type GenerateResult, type SocialChannel } from "@routie/domain";
import { getProviderAdapter, isZarkPilotEnabled, zarkPilotMonthlyImageLimit } from "@routie/providers";
import { deliveryModeFor, flagsFromEnvironment } from "@routie/publishers";
import { decryptSecret } from "@routie/security";
import { createDownloadUrl, putObject } from "@routie/storage";
import { isProviderRateLimit, type ProviderThrottle } from "./provider-throttle";
import { createRedisConnection, QUEUES, type GenerateQueuePayload, type PublishQueuePayload } from "./queues";

type ContentKind = "TEXT" | "IMAGE" | "CAROUSEL" | "SHORT_VIDEO" | "STORY";

function tenantContext(workspaceId: string) {
  return `select set_config('app.workspace_id', '${workspaceId.replaceAll("'", "")}', true)`;
}

function decodeGeneratedImage(result: GenerateResult): { bytes: Buffer; mimeType: string } {
  if (result.status !== "COMPLETED") throw new Error("AI provider has not completed the image");
  const asset = result.assetUrls?.[0];
  if (!asset) throw new Error("AI provider returned no generated image");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(asset);
  if (!match) throw new Error("AI provider returned an unsupported image response");
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > 25 * 1024 * 1024) throw new Error("Generated image size is invalid");
  return { bytes, mimeType: match[1]! };
}

function contentKindFor(recommendedKind: ContentKind | null): ContentKind {
  return recommendedKind === "IMAGE" || recommendedKind === "CAROUSEL" || recommendedKind === "STORY" ? recommendedKind : "IMAGE";
}

function utcMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function enqueuePublishJobs(jobs: Array<{ id: string; scheduledFor: Date }>, workspaceId: string) {
  if (jobs.length === 0) return;
  const queue = new Queue<PublishQueuePayload>(QUEUES.publishing, { connection: createRedisConnection() });
  try {
    await Promise.all(
      jobs.map((job) =>
        queue.add(
          "publish",
          { workspaceId, publishJobId: job.id },
          {
            jobId: job.id,
            delay: Math.max(0, job.scheduledFor.getTime() - Date.now()),
            attempts: 3,
            backoff: { type: "exponential", delay: 5_000 }
          }
        )
      )
    );
  } finally {
    await queue.close();
  }
}

async function enqueueMediaJobs(jobs: GenerateQueuePayload[]) {
  if (jobs.length === 0) return;
  const queue = new Queue<GenerateQueuePayload>(QUEUES.generation, { connection: createRedisConnection() });
  try {
    await Promise.all(
      jobs.map((job) =>
        queue.add("generate-concept-media", job, {
          jobId: `media-${job.target && job.target.kind === "CONCEPT_MEDIA" ? job.target.conceptId : job.request.idempotencyKey}`,
          attempts: 2,
          backoff: { type: "exponential", delay: 15_000 }
        })
      )
    );
  } finally {
    await queue.close();
  }
}

async function runProviderGeneration(
  payload: GenerateQueuePayload,
  apiKey: string,
  credential: typeof providerCredentials.$inferSelect,
  throttle?: Pick<ProviderThrottle, "run">
) {
  const operation = () => getProviderAdapter(credential.provider).generate(apiKey, payload.request);
  return throttle
    ? throttle.run(`${payload.workspaceId}:${credential.id}`, operation)
    : operation();
}

async function processConceptMedia(
  payload: GenerateQueuePayload & { target: { kind: "CONCEPT_MEDIA"; conceptId: string } },
  apiKey: string,
  credential: typeof providerCredentials.$inferSelect,
  throttle?: Pick<ProviderThrottle, "run">
) {
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const conceptId = payload.target.conceptId;
  const context = await db.transaction(async (tx) => {
    await tx.execute(tenantContext(payload.workspaceId));
    const [row] = await tx
      .select({
        concept: contentConcepts,
        channels: contentCalendars.channels,
        scheduledFor: calendarSlots.scheduledFor,
        publicationMode: workspaces.publicationMode
      })
      .from(contentConcepts)
      .innerJoin(calendarSlots, eq(calendarSlots.id, contentConcepts.slotId))
      .innerJoin(contentCalendars, eq(contentCalendars.id, calendarSlots.calendarId))
      .innerJoin(workspaces, eq(workspaces.id, contentConcepts.workspaceId))
      .where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)))
      .limit(1);
    if (!row) throw new Error("Content concept not found");

    const existing = await tx
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .innerJoin(channelVariants, eq(channelVariants.id, mediaAssets.variantId))
      .where(and(eq(channelVariants.conceptId, conceptId), eq(mediaAssets.workspaceId, payload.workspaceId)))
      .limit(1);
    if (existing.length > 0) {
      await tx.update(contentConcepts).set({ state: "FINAL_REVIEW", heldReason: null, updatedAt: new Date() }).where(eq(contentConcepts.id, conceptId));
      return null;
    }
    if (credential.provider === "ZARK") {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${payload.workspaceId}, 0))`);
      let unavailableReason: string | null = null;
      if (!isZarkPilotEnabled(process.env)) {
        unavailableReason = "Fitur percobaan Zark sedang dinonaktifkan. Pilih provider gambar lain atau aktifkan kembali Zark Pilot.";
      } else {
        const monthlyLimit = zarkPilotMonthlyImageLimit(process.env);
        const [usage] = await tx
          .select({ value: count() })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.workspaceId, payload.workspaceId),
              eq(auditEvents.action, "CONTENT_MEDIA_GENERATION_STARTED"),
              gte(auditEvents.createdAt, utcMonthStart()),
              sql`${auditEvents.after}->>'provider' = 'ZARK'`
            )
          );
        if ((usage?.value ?? 0) >= monthlyLimit) {
          unavailableReason = `Batas percobaan gambar bulan ini sudah tercapai (${monthlyLimit} kali). Gunakan provider lain atau naikkan batas pilot secara terkontrol.`;
        }
      }

      if (unavailableReason) {
        await tx
          .update(contentConcepts)
          .set({ state: "FAILED", heldReason: unavailableReason, updatedAt: new Date() })
          .where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
        await tx.insert(auditEvents).values({
          workspaceId: payload.workspaceId,
          actorId: null,
          action: "CONTENT_MEDIA_GENERATION_FAILED",
          entityType: "content_concept",
          entityId: conceptId,
          before: { state: row.concept.state },
          after: { state: "FAILED", provider: "ZARK", reason: unavailableReason }
        });
        return null;
      }
    }
    if (!["IDEA_APPROVED", "GENERATING", "FAILED"].includes(row.concept.state)) {
      throw new Error(`Content cannot be rendered from state ${row.concept.state}`);
    }
    await tx.update(contentConcepts).set({ state: "GENERATING", heldReason: null, updatedAt: new Date() }).where(eq(contentConcepts.id, conceptId));
    const [creativeBrief] = await tx.select({ id: creativeBriefs.id }).from(creativeBriefs)
      .where(and(eq(creativeBriefs.conceptId, conceptId), eq(creativeBriefs.workspaceId, payload.workspaceId))).limit(1);
    if (creativeBrief) {
      await tx.update(generationRuns).set({ status: "PROCESSING", startedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(generationRuns.creativeBriefId, creativeBrief.id), eq(generationRuns.status, "QUEUED")));
      await tx.update(creativeBriefs).set({ status: "GENERATING", updatedAt: new Date() }).where(eq(creativeBriefs.id, creativeBrief.id));
    }
    await tx.insert(auditEvents).values({
      workspaceId: payload.workspaceId,
      actorId: null,
      action: "CONTENT_MEDIA_GENERATION_STARTED",
      entityType: "content_concept",
      entityId: conceptId,
      before: { state: row.concept.state },
      after: { state: "GENERATING", provider: credential.provider, model: credential.model }
    });
    return row;
  });
  if (!context) return { status: "COMPLETED" as const };
  const scheduledFor = context.scheduledFor;
  if (!scheduledFor) throw new Error("Content has no scheduled publish time");

  try {
    const result = await runProviderGeneration(payload, apiKey, credential, throttle);
    const image = decodeGeneratedImage(result);
    const masterAspectRatio = payload.request.aspectRatio ?? "1:1";
    const dimensions = masterAspectRatio === "1:1" ? { width: 1024, height: 1024 } : masterAspectRatio === "16:9" ? { width: 1536, height: 1024 } : { width: 1024, height: 1536 };
    const extension = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType.split("/")[1]!;
    const objectKey = `${payload.workspaceId}/concepts/${conceptId}/v${context.concept.version}/master.${extension}`;
    const checksum = createHash("sha256").update(image.bytes).digest("hex");
    await putObject(objectKey, image.bytes, image.mimeType, { concept: conceptId, provider: credential.provider.toLowerCase() });

    const flags = flagsFromEnvironment();
    const variantKind = contentKindFor(context.concept.recommendedKind);
    const publishJobsToQueue = await db.transaction(async (tx) => {
      await tx.execute(tenantContext(payload.workspaceId));
      const automatic = context.publicationMode === "AUTOMATIC";
      const approvalTime = automatic ? new Date() : null;
      for (const channel of context.channels as SocialChannel[]) {
        const deliveryMode = deliveryModeFor(channel, flags) as DeliveryMode;
        const [variant] = await tx
          .insert(channelVariants)
          .values({
            workspaceId: payload.workspaceId,
            conceptId,
            channel,
            deliveryMode,
            contentKind: variantKind,
            caption: context.concept.initialCaption,
            approvedAt: approvalTime,
            approvedBy: null,
            metadata: { generatedFrom: context.concept.recommendedKind, masterAspectRatio }
          })
          .onConflictDoUpdate({
            target: [channelVariants.conceptId, channelVariants.channel],
            set: {
              deliveryMode,
              contentKind: variantKind,
              caption: context.concept.initialCaption,
              metadata: { generatedFrom: context.concept.recommendedKind, masterAspectRatio },
              approvedAt: approvalTime,
              approvedBy: null,
              rejectedAt: null,
              rejectionReason: null,
              updatedAt: new Date()
            }
          })
          .returning();
        if (!variant) throw new Error(`Failed to create ${channel} variant`);
        const existingAsset = await tx
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(and(eq(mediaAssets.variantId, variant.id), eq(mediaAssets.objectKey, objectKey)))
          .limit(1);
        if (existingAsset.length === 0) {
          await tx.insert(mediaAssets).values({
            workspaceId: payload.workspaceId,
            variantId: variant.id,
            kind: "IMAGE",
            source: "AI_GENERATED",
            objectKey,
            mimeType: image.mimeType,
            sizeBytes: image.bytes.byteLength,
            width: dimensions.width,
            height: dimensions.height,
            checksum,
            generationMetadata: {
              provider: credential.provider,
              model: credential.model,
              providerJobId: result.providerJobId,
              usage: result.usage ?? {},
              promptVersion: 1,
              aspectRatio: masterAspectRatio,
              referenceImageCount: payload.request.inputAssetUrls?.length ?? 0
            }
          });
        }
      }
      if (!automatic) {
        await tx
          .update(contentConcepts)
          .set({ state: "FINAL_REVIEW", heldReason: null, updatedAt: new Date() })
          .where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
      }
      const jobsToQueue: Array<{ id: string; scheduledFor: Date }> = [];
      if (automatic) {
        const [variants, connections] = await Promise.all([
          tx
            .select()
            .from(channelVariants)
            .where(and(eq(channelVariants.conceptId, conceptId), eq(channelVariants.workspaceId, payload.workspaceId))),
          tx.select().from(socialConnections).where(eq(socialConnections.workspaceId, payload.workspaceId))
        ]);
        for (const variant of variants) {
          const connection = connections.find(
            (candidate) =>
              candidate.channel === variant.channel &&
              !candidate.disconnectedAt &&
              !candidate.reauthorizationRequiredAt &&
              Boolean(candidate.encryptedAccessToken)
          );
          const queued = Boolean(connection);
          const [job] = await tx
            .insert(publishJobs)
            .values({
              workspaceId: payload.workspaceId,
              variantId: variant.id,
              connectionId: connection?.id,
              scheduledFor,
              status: queued ? "QUEUED" : "HELD",
              heldReason: queued ? null : "SOCIAL_RECONNECT_REQUIRED",
              idempotencyKey: `${variant.id}:${scheduledFor.toISOString()}:v${variant.version}`
            })
            .onConflictDoNothing({ target: publishJobs.idempotencyKey })
            .returning();
          if (job && queued) jobsToQueue.push({ id: job.id, scheduledFor: job.scheduledFor });
        }
        await tx
          .update(contentConcepts)
          .set({
            state: jobsToQueue.length > 0 ? "SCHEDULED" : "HELD",
            heldReason: jobsToQueue.length > 0 ? null : "Hubungkan akun sosial media tujuan agar konten dapat diterbitkan.",
            updatedAt: new Date()
          })
          .where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
      }
      await tx.insert(auditEvents).values({
        workspaceId: payload.workspaceId,
        actorId: null,
        action: "CONTENT_MEDIA_GENERATED",
        entityType: "content_concept",
        entityId: conceptId,
        before: { state: "GENERATING" },
        after: {
          state: automatic ? (jobsToQueue.length > 0 ? "SCHEDULED" : "HELD") : "FINAL_REVIEW",
          provider: credential.provider,
          model: credential.model,
          providerJobId: result.providerJobId,
          usage: result.usage ?? {},
          channels: context.channels.length,
          checksum
        }
      });
      const [creativeBrief] = await tx.select({ id: creativeBriefs.id }).from(creativeBriefs)
        .where(and(eq(creativeBriefs.conceptId, conceptId), eq(creativeBriefs.workspaceId, payload.workspaceId))).limit(1);
      if (creativeBrief) {
        await tx.update(creativeBriefs).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(creativeBriefs.id, creativeBrief.id));
        await tx.update(generationRuns).set({ status: "SUCCEEDED", usage: result.usage ? { ...result.usage } : {}, completedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(generationRuns.creativeBriefId, creativeBrief.id), eq(generationRuns.status, "PROCESSING")));
      }
      if (!automatic) {
        await tx.insert(notifications).values({
          workspaceId: payload.workspaceId,
          kind: "APPROVAL_REQUIRED",
          title: "Konten siap ditinjau",
          body: `Visual untuk "${context.concept.topic}" sudah siap ditinjau.`,
          actionUrl: "/approvals"
        });
      }
      return jobsToQueue;
    });
    await enqueuePublishJobs(publishJobsToQueue, payload.workspaceId);
    return result;
  } catch (error) {
    const normalized = (error as {
      normalized?: {
        code?: string;
        provider?: string;
        retryable?: boolean;
        details?: { httpStatus?: number; sanitizedBody?: unknown };
      };
    }).normalized;
    if (normalized?.retryable === true) {
      console.warn(JSON.stringify({
        level: "warn",
        message: "Retryable media generation failure",
        conceptId,
        provider: credential.provider,
        code: normalized.code,
        httpStatus: normalized.details?.httpStatus
      }));
      throw error;
    }

    const reason = (error instanceof Error ? error.message : "Media generation failed").slice(0, 1_000);
    await db.transaction(async (tx) => {
      await tx.execute(tenantContext(payload.workspaceId));
      await tx.update(contentConcepts).set({ state: "FAILED", heldReason: reason, updatedAt: new Date() }).where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
      await tx.insert(auditEvents).values({
        workspaceId: payload.workspaceId,
        actorId: null,
        action: "CONTENT_MEDIA_GENERATION_FAILED",
        entityType: "content_concept",
        entityId: conceptId,
        before: { state: "GENERATING" },
        after: { state: "FAILED", reason }
      });
      const [creativeBrief] = await tx.select({ id: creativeBriefs.id }).from(creativeBriefs)
        .where(and(eq(creativeBriefs.conceptId, conceptId), eq(creativeBriefs.workspaceId, payload.workspaceId))).limit(1);
      if (creativeBrief) {
        await tx.update(creativeBriefs).set({ status: "FAILED", updatedAt: new Date() }).where(eq(creativeBriefs.id, creativeBrief.id));
        await tx.update(generationRuns).set({ status: "FAILED", errorCode: normalized?.code ?? "GENERATION_FAILED", errorMessage: reason, completedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(generationRuns.creativeBriefId, creativeBrief.id), eq(generationRuns.status, "PROCESSING")));
      }
    });
    if (credential.provider === "ZARK" || normalized?.retryable === false) return { status: "COMPLETED" as const };
    throw error;
  }
}

export async function processGeneration(payload: GenerateQueuePayload, throttle?: Pick<ProviderThrottle, "run">) {
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const [credential] = await db.transaction(async (tx) => {
    await tx.execute(tenantContext(payload.workspaceId));
    return tx
      .select()
      .from(providerCredentials)
      .where(and(eq(providerCredentials.id, payload.credentialId), eq(providerCredentials.workspaceId, payload.workspaceId)))
      .limit(1);
  });
  if (!credential || credential.disabledAt) throw new Error("AI credential is unavailable");
  const masterKey = process.env.ENVELOPE_MASTER_KEY;
  if (!masterKey) throw new Error("ENVELOPE_MASTER_KEY is required by the worker");
  const apiKey = decryptSecret(credential.encryptedSecret, masterKey, `${payload.workspaceId}:${credential.provider}:${credential.capability}`);

  if (payload.target?.kind === "CONCEPT_MEDIA") {
    const conceptTarget = payload.target;
    // Product posters always resolve the newest Brand Identity and source assets at
    // execution time. A queued job must never overwrite a user's latest changes.
    const poster = await db.transaction(async (tx) => {
      await tx.execute(tenantContext(payload.workspaceId));
      const [briefRow] = await tx
        .select({ brief: creativeBriefs, product: products, profile: brandProfiles })
        .from(creativeBriefs)
        .innerJoin(products, eq(products.id, creativeBriefs.productId))
        .innerJoin(brandProfiles, eq(brandProfiles.workspaceId, creativeBriefs.workspaceId))
        .where(and(eq(creativeBriefs.conceptId, conceptTarget.conceptId), eq(creativeBriefs.workspaceId, payload.workspaceId)))
        .limit(1);
      if (!briefRow) return null;
      const [productImages, workspaceImages] = await Promise.all([
        tx.select({ asset: brandAssets }).from(productAssets).innerJoin(brandAssets, eq(brandAssets.id, productAssets.brandAssetId))
          .where(and(eq(productAssets.productId, briefRow.product.id), eq(productAssets.workspaceId, payload.workspaceId)))
          .orderBy(productAssets.sortOrder),
        tx.select().from(brandAssets).where(eq(brandAssets.workspaceId, payload.workspaceId))
      ]);
      return { ...briefRow, productImages: productImages.map((row) => row.asset), brandReferences: workspaceImages.filter((asset) => (asset.metadata as Record<string, unknown>).usage === "BRAND_STYLE_REFERENCE") };
    });
    if (poster) {
      const sourceAssets = [...poster.productImages, ...poster.brandReferences].slice(0, 6);
      payload = {
        ...payload,
        request: {
          ...payload.request,
          prompt: [buildProductPosterPrompt({
            ...poster.profile,
            productName: poster.product.name,
            productDescription: poster.product.description,
            productBenefits: poster.product.benefits,
            headline: poster.brief.headline,
            subheadline: poster.brief.subheadline,
            offerText: poster.brief.offerText,
            callToAction: poster.brief.callToAction,
            visualStyle: poster.brief.visualStyle,
            recipeCode: poster.brief.recipeCode,
            aspectRatio: poster.brief.aspectRatio as "1:1" | "4:5" | "9:16"
          }), `Input image order: the first ${poster.productImages.length} image(s) are product references and must be preserved; any remaining image(s) are brand-style references only.`].join("\n"),
          aspectRatio: poster.brief.aspectRatio as "1:1" | "4:5" | "9:16",
          inputAssetUrls: await Promise.all(sourceAssets.map((asset) => createDownloadUrl(asset.objectKey, 300, { disposition: "inline" })))
        }
      };
    }
    return processConceptMedia(
      payload as GenerateQueuePayload & { target: { kind: "CONCEPT_MEDIA"; conceptId: string } },
      apiKey,
      credential,
      throttle
    );
  }

  // Calendar ideas must always use the profile that exists at execution time.
  // Jobs can wait in Redis while the user updates Brand Identity; never let an
  // older prompt override the user's latest saved brand.
  let request = payload.request;
  if (payload.target?.kind === "CALENDAR_IDEAS") {
    const [profile] = await db.transaction(async (tx) => {
      await tx.execute(tenantContext(payload.workspaceId));
      return tx.select().from(brandProfiles).where(eq(brandProfiles.workspaceId, payload.workspaceId)).limit(1);
    });
    if (!profile) throw new Error("Brand Identity belum tersedia untuk membuat ide konten.");
    const currentContext = buildBrandContext(profile);
    const withoutQueuedContext = request.prompt
      .replace(/\[BRAND_CONTEXT_START\][\s\S]*?\[BRAND_CONTEXT_END\]\s*/g, "")
      // Compatibility for jobs created before the explicit context markers.
      .split("\n")
      .filter((line) => !/^(Brand|Brief|Audience|Tone|Pillar|Larangan klaim):/i.test(line.trim()))
      .join("\n")
      .trim();
    request = {
      ...request,
      prompt: [
        "Gunakan Brand Identity TERBARU di bawah ini sebagai sumber kebenaran. Jangan menyebut, mempromosikan, atau memakai brand lain kecuali memang tertulis pada Brand Identity ini.",
        currentContext,
        withoutQueuedContext
      ].join("\n\n")
    };
  }

  const result = await runProviderGeneration({ ...payload, request }, apiKey, credential, throttle);
  if (payload.target?.kind === "CALENDAR_IDEAS") {
    const target = payload.target;
    if (result.status !== "COMPLETED" || !result.text) throw new Error("AI provider did not return completed calendar ideas");

    let ideas: Array<Record<string, unknown>> = [];
    const firstBracket = result.text.indexOf("[");
    const lastBracket = result.text.lastIndexOf("]");
    const firstBrace = result.text.indexOf("{");
    const lastBrace = result.text.lastIndexOf("}");

    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        const parsed = JSON.parse(result.text.slice(firstBracket, lastBracket + 1));
        ideas = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // continue
      }
    }

    if (ideas.length === 0 && firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(result.text.slice(firstBrace, lastBrace + 1));
        ideas = [parsed];
      } catch {
        // continue
      }
    }

    if (ideas.length === 0) {
      throw new Error("AI provider returned invalid JSON format for calendar ideas");
    }

    const allowedKinds = new Set(["TEXT", "IMAGE", "CAROUSEL", "SHORT_VIDEO", "STORY"]);
    const automaticMediaJobs: GenerateQueuePayload[] = [];
    await db.transaction(async (tx) => {
      await tx.execute(tenantContext(payload.workspaceId));
      const [[profile], [imageCredential]] = await Promise.all([
        tx.select().from(brandProfiles).where(eq(brandProfiles.workspaceId, payload.workspaceId)).limit(1),
        tx
          .select()
          .from(providerCredentials)
          .where(and(eq(providerCredentials.workspaceId, payload.workspaceId), eq(providerCredentials.capability, "IMAGE"), sql`${providerCredentials.disabledAt} is null`))
          .limit(1)
      ]);
      const canCreateVisual = Boolean(profile && imageCredential);
      for (const [index, conceptId] of target.conceptIds.entries()) {
        const [storedConcept] = await tx.select().from(contentConcepts).where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId))).limit(1);
        if (!storedConcept) continue;
        const automatic = storedConcept.generationMode === "AUTOMATIC";
        const idea = ideas[index] || ideas[0] || {};
        const rawHashtags = Array.isArray(idea.hashtags)
          ? idea.hashtags.map((tag) => String(tag).trim()).filter((t) => t.length > 0)
          : [];
        const recommendedKind =
          typeof idea.recommendedKind === "string" && allowedKinds.has(idea.recommendedKind)
            ? (idea.recommendedKind as ContentKind)
            : "IMAGE";
        const nextState = automatic ? (canCreateVisual ? "GENERATING" : "HELD") : "IDEA_REVIEW";
        const heldReason = automatic && !canCreateVisual
          ? "Untuk Mode Otomatis, hubungkan terlebih dahulu layanan AI untuk membuat visual."
          : null;
        await tx.update(contentConcepts).set({
          topic: String(idea.topic ?? "Ide Konten"),
          hook: String(idea.hook ?? ""),
          outline: String(idea.outline ?? ""),
          initialCaption: String(idea.initialCaption ?? ""),
          hashtags: rawHashtags,
          contentPillar: String(idea.contentPillar ?? "Umum"),
          visualPrompt: String(idea.visualPrompt ?? storedConcept.visualPrompt),
          recommendedKind,
          state: nextState,
          heldReason,
          updatedAt: new Date()
        }).where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
        if (automatic && profile && imageCredential) {
          const referenceAssets = storedConcept.referenceAssetIds.length
            ? await tx.select().from(brandAssets).where(and(eq(brandAssets.workspaceId, payload.workspaceId), inArray(brandAssets.id, storedConcept.referenceAssetIds)))
            : [];
          const inputAssetUrls = await Promise.all(referenceAssets.map((asset) => createDownloadUrl(asset.objectKey, 300, { disposition: "inline" })));
          const visualPrompt = String(idea.visualPrompt ?? storedConcept.visualPrompt);
          automaticMediaJobs.push({
            workspaceId: payload.workspaceId,
            credentialId: imageCredential.id,
            request: {
              capability: "IMAGE",
              model: imageCredential.model,
              prompt: visualPrompt,
              inputAssetUrls,
              aspectRatio: recommendedKind === "STORY" || recommendedKind === "SHORT_VIDEO" ? "9:16" : "1:1",
              idempotencyKey: `concept-media:${conceptId}:v1`
            },
            target: { kind: "CONCEPT_MEDIA", conceptId }
          });
        }
        if (result.sources?.length) {
          await tx.insert(conceptResearchSources).values(result.sources.map((source) => ({
            workspaceId: payload.workspaceId,
            conceptId,
            url: source.url,
            title: source.title,
            excerpt: source.excerpt,
            accessedAt: source.accessedAt,
            raw: source
          })));
        }
      }
      await tx.insert(auditEvents).values({
        workspaceId: payload.workspaceId,
        actorId: null,
        action: "CALENDAR_IDEAS_GENERATED",
        entityType: "content_calendar",
        entityId: target.calendarId,
        after: { conceptCount: ideas.length, provider: credential.provider, model: credential.model }
      });
      await tx.insert(notifications).values({ workspaceId: payload.workspaceId, kind: "APPROVAL_REQUIRED", title: "Konten siap ditinjau", body: `${target.conceptIds.length} konten sudah dibuat dan siap diperiksa.`, actionUrl: "/calendar" });
    });
    await enqueueMediaJobs(automaticMediaJobs);
  }
  return result;
}

export function friendlyGenerationFailure(error: unknown): string {
  const normalized = (error as {
    normalized?: { code?: string; provider?: string; details?: { httpStatus?: number } };
  }).normalized;
  if (isProviderRateLimit(error)) {
    return "Layanan AI sedang sibuk atau kuotanya sedang penuh. Routie sudah memberi jeda dan mencoba kembali, tetapi provider masih membatasi permintaan. Coba lagi beberapa menit lagi.";
  }
  if (normalized?.code === "PROVIDER_THROTTLE_TIMEOUT") {
    return "Antrean AI sedang sangat padat. Coba lagi beberapa saat lagi.";
  }
  if ((normalized?.details?.httpStatus ?? 0) >= 500) {
    return "Layanan AI sedang mengalami gangguan sementara. Routie sudah mencoba kembali secara aman. Coba lagi beberapa menit lagi.";
  }
  if (error instanceof Error && error.message.trim()) {
    return `Gagal memproses ide dari AI: ${error.message.slice(0, 240)}.`;
  }
  return "Gagal memproses ide dari AI. Silakan coba lagi.";
}

export async function handleGenerationFailure(payload: GenerateQueuePayload, error: unknown) {
  try {
    const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
    const reason = friendlyGenerationFailure(error);
    const normalized = (error as { normalized?: { code?: string; provider?: string } }).normalized;
    await db.transaction(async (tx) => {
      await tx.execute(tenantContext(payload.workspaceId));
      if (payload.target?.kind === "CALENDAR_IDEAS") {
        for (const conceptId of payload.target.conceptIds) {
          await tx
            .update(contentConcepts)
            .set({
              state: "HELD",
              topic: sql`case when ${contentConcepts.topic} = 'Menyusun ide konten...' then 'Ide belum berhasil dibuat' else ${contentConcepts.topic} end`,
              heldReason: reason,
              updatedAt: new Date()
            })
            .where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
          await tx.insert(auditEvents).values({
            workspaceId: payload.workspaceId,
            actorId: null,
            action: "CALENDAR_IDEA_GENERATION_FAILED",
            entityType: "content_concept",
            entityId: conceptId,
            after: {
              state: "HELD",
              reason,
              code: normalized?.code ?? null,
              provider: normalized?.provider ?? null
            }
          });
        }
      } else if (payload.target?.kind === "CONCEPT_MEDIA") {
        await tx
          .update(contentConcepts)
          .set({
            state: "HELD",
            heldReason: `Gagal membuat gambar: ${reason}`,
            updatedAt: new Date()
          })
          .where(and(eq(contentConcepts.id, payload.target.conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
        await tx.insert(auditEvents).values({
          workspaceId: payload.workspaceId,
          actorId: null,
          action: "CONTENT_MEDIA_GENERATION_FAILED",
          entityType: "content_concept",
          entityId: payload.target.conceptId,
          after: {
            state: "HELD",
            reason,
            code: normalized?.code ?? null,
            provider: normalized?.provider ?? null
          }
        });
      }
    });
  } catch (err) {
    console.error("Failed to mark concept as HELD on worker failure:", err);
  }
}
