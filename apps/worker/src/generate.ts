import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  auditEvents,
  calendarSlots,
  channelVariants,
  conceptResearchSources,
  contentCalendars,
  contentConcepts,
  createDatabase,
  mediaAssets,
  providerCredentials
} from "@routie/db";
import type { DeliveryMode, GenerateResult, SocialChannel } from "@routie/domain";
import { getProviderAdapter } from "@routie/providers";
import { deliveryModeFor, flagsFromEnvironment } from "@routie/publishers";
import { decryptSecret } from "@routie/security";
import { putObject } from "@routie/storage";
import type { GenerateQueuePayload } from "./queues";

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

async function processConceptMedia(payload: GenerateQueuePayload & { target: { kind: "CONCEPT_MEDIA"; conceptId: string } }, apiKey: string, credential: typeof providerCredentials.$inferSelect) {
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const conceptId = payload.target.conceptId;
  const context = await db.transaction(async (tx) => {
    await tx.execute(tenantContext(payload.workspaceId));
    const [row] = await tx
      .select({ concept: contentConcepts, channels: contentCalendars.channels })
      .from(contentConcepts)
      .innerJoin(calendarSlots, eq(calendarSlots.id, contentConcepts.slotId))
      .innerJoin(contentCalendars, eq(contentCalendars.id, calendarSlots.calendarId))
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
    if (!["IDEA_APPROVED", "GENERATING", "FAILED"].includes(row.concept.state)) {
      throw new Error(`Content cannot be rendered from state ${row.concept.state}`);
    }
    await tx.update(contentConcepts).set({ state: "GENERATING", heldReason: null, updatedAt: new Date() }).where(eq(contentConcepts.id, conceptId));
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

  try {
    const result = await getProviderAdapter(credential.provider).generate(apiKey, payload.request);
    const image = decodeGeneratedImage(result);
    const extension = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType.split("/")[1]!;
    const objectKey = `${payload.workspaceId}/concepts/${conceptId}/v${context.concept.version}/master.${extension}`;
    const checksum = createHash("sha256").update(image.bytes).digest("hex");
    await putObject(objectKey, image.bytes, image.mimeType, { concept: conceptId, provider: credential.provider.toLowerCase() });

    const flags = flagsFromEnvironment();
    const variantKind = contentKindFor(context.concept.recommendedKind);
    await db.transaction(async (tx) => {
      await tx.execute(tenantContext(payload.workspaceId));
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
            metadata: { generatedFrom: context.concept.recommendedKind, masterAspectRatio: "1:1" }
          })
          .onConflictDoUpdate({
            target: [channelVariants.conceptId, channelVariants.channel],
            set: {
              deliveryMode,
              contentKind: variantKind,
              caption: context.concept.initialCaption,
              metadata: { generatedFrom: context.concept.recommendedKind, masterAspectRatio: "1:1" },
              approvedAt: null,
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
            width: 1024,
            height: 1024,
            checksum,
            generationMetadata: { provider: credential.provider, model: credential.model, usage: result.usage ?? {}, promptVersion: 1 }
          });
        }
      }
      await tx.update(contentConcepts).set({ state: "FINAL_REVIEW", heldReason: null, updatedAt: new Date() }).where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
      await tx.insert(auditEvents).values({
        workspaceId: payload.workspaceId,
        actorId: null,
        action: "CONTENT_MEDIA_GENERATED",
        entityType: "content_concept",
        entityId: conceptId,
        before: { state: "GENERATING" },
        after: { state: "FINAL_REVIEW", provider: credential.provider, model: credential.model, channels: context.channels.length, checksum }
      });
    });
    return result;
  } catch (error) {
    const normalized = (error as { normalized?: { retryable?: boolean; details?: { sanitizedBody?: unknown } } }).normalized;
    const detail = typeof normalized?.details?.sanitizedBody === "string" ? `: ${normalized.details.sanitizedBody}` : "";
    const reason = `${error instanceof Error ? error.message : "Media generation failed"}${detail}`.slice(0, 1_000);
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
    });
    if (normalized?.retryable === false) return { status: "COMPLETED" as const };
    throw error;
  }
}

export async function processGeneration(payload: GenerateQueuePayload) {
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
    return processConceptMedia(payload as GenerateQueuePayload & { target: { kind: "CONCEPT_MEDIA"; conceptId: string } }, apiKey, credential);
  }

  const result = await getProviderAdapter(credential.provider).generate(apiKey, payload.request);
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
    await db.transaction(async (tx) => {
      await tx.execute(tenantContext(payload.workspaceId));
      for (const [index, conceptId] of target.conceptIds.entries()) {
        const idea = ideas[index] || ideas[0] || {};
        const rawHashtags = Array.isArray(idea.hashtags)
          ? idea.hashtags.map((tag) => String(tag).trim()).filter((t) => t.length > 0)
          : [];
        const recommendedKind =
          typeof idea.recommendedKind === "string" && allowedKinds.has(idea.recommendedKind)
            ? (idea.recommendedKind as ContentKind)
            : "IMAGE";
        await tx.update(contentConcepts).set({
          topic: String(idea.topic ?? "Ide Konten"),
          hook: String(idea.hook ?? ""),
          outline: String(idea.outline ?? ""),
          initialCaption: String(idea.initialCaption ?? ""),
          hashtags: rawHashtags,
          contentPillar: String(idea.contentPillar ?? "Umum"),
          recommendedKind,
          state: "IDEA_REVIEW",
          updatedAt: new Date()
        }).where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
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
    });
  }
  return result;
}

export async function handleGenerationFailure(payload: GenerateQueuePayload, errorMessage: string) {
  try {
    const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
    await db.transaction(async (tx) => {
      await tx.execute(tenantContext(payload.workspaceId));
      if (payload.target?.kind === "CALENDAR_IDEAS") {
        for (const conceptId of payload.target.conceptIds) {
          await tx
            .update(contentConcepts)
            .set({
              state: "HELD",
              heldReason: `Gagal memproses ide dari AI: ${errorMessage.slice(0, 200)}. Silakan edit atau generate ulang.`,
              updatedAt: new Date()
            })
            .where(and(eq(contentConcepts.id, conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
        }
      } else if (payload.target?.kind === "CONCEPT_MEDIA") {
        await tx
          .update(contentConcepts)
          .set({
            state: "HELD",
            heldReason: `Gagal membuat gambar: ${errorMessage.slice(0, 200)}. Silakan coba render ulang.`,
            updatedAt: new Date()
          })
          .where(and(eq(contentConcepts.id, payload.target.conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
      }
    });
  } catch (err) {
    console.error("Failed to mark concept as HELD on worker failure:", err);
  }
}
