import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { Queue } from "bullmq";
import { channelVariants, createDatabase, entitlements, mediaAssets, notifications, publishJobs, socialConnections, workspaces } from "@routie/db";
import { evaluateEntitlement } from "@routie/domain";
import { decryptSecret, encryptSecret, refreshTikTokAccessToken, TikTokOAuthError } from "@routie/security";
import { deleteObject, deletePrefix } from "@routie/storage";
import { createRedisConnection, QUEUES } from "./queues";

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Refreshes TikTok tokens before their 24-hour lifetime ends. A user only sees
 * a reconnect action when TikTok has permanently revoked the authorization. */
export async function refreshExpiringTikTokConnections(
  now = new Date()
): Promise<{ refreshed: number; reconnectRequired: number; failed: number }> {
  const masterKey = process.env.ENVELOPE_MASTER_KEY;
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!masterKey || !clientKey || !clientSecret) return { refreshed: 0, reconnectRequired: 0, failed: 0 };

  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const candidates = await db
    .select()
    .from(socialConnections)
    .where(
      and(
        eq(socialConnections.channel, "TIKTOK"),
        isNull(socialConnections.disconnectedAt),
        isNull(socialConnections.reauthorizationRequiredAt),
        isNotNull(socialConnections.encryptedRefreshToken),
        isNotNull(socialConnections.tokenExpiresAt),
        lte(socialConnections.tokenExpiresAt, new Date(now.getTime() + 6 * 60 * 60_000))
      )
    );
  let refreshed = 0;
  let reconnectRequired = 0;
  let failed = 0;
  for (const connection of candidates) {
    try {
      const refreshToken = decryptSecret(
        connection.encryptedRefreshToken!,
        masterKey,
        `${connection.workspaceId}:TIKTOK:refresh-token`
      );
      const token = await refreshTikTokAccessToken(refreshToken, clientKey, clientSecret);
      await db
        .update(socialConnections)
        .set({
          encryptedAccessToken: encryptSecret(token.accessToken, masterKey, `${connection.workspaceId}:TIKTOK:access-token`),
          encryptedRefreshToken: encryptSecret(token.refreshToken, masterKey, `${connection.workspaceId}:TIKTOK:refresh-token`),
          tokenExpiresAt: token.expiresAt,
          updatedAt: now
        })
        .where(eq(socialConnections.id, connection.id));
      refreshed += 1;
    } catch (error) {
      if (error instanceof TikTokOAuthError && error.permanent) {
        await db
          .update(socialConnections)
          .set({ reauthorizationRequiredAt: now, reauthorizationReason: error.code, updatedAt: now })
          .where(eq(socialConnections.id, connection.id));
        reconnectRequired += 1;
      } else {
        // Keep the existing connection intact for the next scheduled attempt.
        failed += 1;
        console.error("[TikTok] Automatic token refresh failed", { connectionId: connection.id });
      }
    }
  }
  return { refreshed, reconnectRequired, failed };
}

/** Releases schedules that were safely held while TikTok review/Draft Sync was
 * disabled. This is safe to run at startup and on the token maintenance tick. */
export async function resumePendingTikTokDraftJobs(): Promise<number> {
  if (process.env.ENABLE_TIKTOK_DRAFT_SYNC !== "true") return 0;
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const held = await db
    .select({ id: publishJobs.id, workspaceId: publishJobs.workspaceId })
    .from(publishJobs)
    .innerJoin(channelVariants, eq(channelVariants.id, publishJobs.variantId))
    .innerJoin(socialConnections, eq(socialConnections.id, publishJobs.connectionId))
    .where(
      and(
        eq(publishJobs.status, "HELD"),
        eq(publishJobs.heldReason, "TIKTOK_DRAFT_SYNC_PENDING"),
        eq(channelVariants.channel, "TIKTOK"),
        eq(socialConnections.deliveryMode, "PLATFORM_DRAFT"),
        isNull(socialConnections.disconnectedAt),
        isNull(socialConnections.reauthorizationRequiredAt)
      )
    );
  if (held.length === 0) return 0;
  await db
    .update(publishJobs)
    .set({ status: "QUEUED", heldReason: null, lastError: null, updatedAt: new Date() })
    .where(inArray(publishJobs.id, held.map((job) => job.id)));

  const connection = createRedisConnection();
  const queue = new Queue(QUEUES.publishing, { connection });
  try {
    await Promise.all(
      held.map((job) =>
        queue.add("publish", { workspaceId: job.workspaceId, publishJobId: job.id }, { jobId: `tiktok-draft-${job.id}-${Date.now()}` })
      )
    );
  } catch (error) {
    await db
      .update(publishJobs)
      .set({ status: "HELD", heldReason: "TIKTOK_DRAFT_SYNC_PENDING", updatedAt: new Date() })
      .where(inArray(publishJobs.id, held.map((job) => job.id)));
    throw error;
  } finally {
    await queue.close();
    await connection.quit();
  }
  return held.length;
}

interface RetentionJob {
  variantId: string;
  status: "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "HELD" | "CANCELED";
  updatedAt: Date;
}

export function isMediaObjectRetentionEligible(variantIds: string[], jobs: RetentionJob[], cutoff: Date): boolean {
  if (variantIds.length === 0) return false;
  return variantIds.every((variantId) => {
    const variantJobs = jobs.filter((job) => job.variantId === variantId);
    const successfulJobs = variantJobs.filter((job) => job.status === "SUCCEEDED");
    const hasActiveJob = variantJobs.some((job) => ["QUEUED", "PROCESSING", "HELD"].includes(job.status));
    return !hasActiveJob && successfulJobs.length > 0 && successfulJobs.every((job) => job.updatedAt <= cutoff);
  });
}

export async function archivePublishedMedia(
  now = new Date(),
  retentionDays = Number(process.env.MEDIA_RETENTION_DAYS ?? 30)
): Promise<{ objectsArchived: number; assetsArchived: number; freedBytes: number; failed: number }> {
  const safeRetentionDays = Number.isFinite(retentionDays) && retentionDays >= 1 ? Math.floor(retentionDays) : 30;
  const cutoff = new Date(now.getTime() - safeRetentionDays * DAY_MS);
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const possibleAssets = await db
    .select({
      workspaceId: mediaAssets.workspaceId,
      objectKey: mediaAssets.objectKey
    })
    .from(mediaAssets)
    .innerJoin(channelVariants, eq(channelVariants.id, mediaAssets.variantId))
    .innerJoin(publishJobs, eq(publishJobs.variantId, channelVariants.id))
    .where(and(isNull(mediaAssets.archivedAt), eq(publishJobs.status, "SUCCEEDED"), lt(publishJobs.updatedAt, cutoff)));

  const objectCandidates = new Map<string, { workspaceId: string; objectKey: string }>();
  for (const asset of possibleAssets) {
    objectCandidates.set(`${asset.workspaceId}:${asset.objectKey}`, asset);
  }

  let objectsArchived = 0;
  let assetsArchived = 0;
  let freedBytes = 0;
  let failed = 0;

  for (const candidate of objectCandidates.values()) {
    const references = await db
      .select({ id: mediaAssets.id, variantId: mediaAssets.variantId, sizeBytes: mediaAssets.sizeBytes })
      .from(mediaAssets)
      .where(and(
        eq(mediaAssets.workspaceId, candidate.workspaceId),
        eq(mediaAssets.objectKey, candidate.objectKey),
        isNull(mediaAssets.archivedAt)
      ));
    const variantIds = [...new Set(references.flatMap((asset) => asset.variantId ? [asset.variantId] : []))];
    if (variantIds.length !== references.length) continue;

    const jobs = await db
      .select({ variantId: publishJobs.variantId, status: publishJobs.status, updatedAt: publishJobs.updatedAt })
      .from(publishJobs)
      .where(inArray(publishJobs.variantId, variantIds));
    if (!isMediaObjectRetentionEligible(variantIds, jobs, cutoff)) continue;

    try {
      await deleteObject(candidate.objectKey);
      const archivedAt = new Date();
      const assetIds = references.map((asset) => asset.id);
      const objectSize = Math.max(0, ...references.map((asset) => asset.sizeBytes));
      await db.transaction(async (tx) => {
        await tx.update(mediaAssets).set({ archivedAt, updatedAt: archivedAt }).where(inArray(mediaAssets.id, assetIds));
        await tx.update(workspaces).set({
          storageUsedBytes: sql`greatest(0, ${workspaces.storageUsedBytes} - ${objectSize})`,
          updatedAt: archivedAt
        }).where(eq(workspaces.id, candidate.workspaceId));
      });
      objectsArchived += 1;
      assetsArchived += references.length;
      freedBytes += objectSize;
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        level: "error",
        message: "Failed to archive published media object",
        workspaceId: candidate.workspaceId,
        error: error instanceof Error ? error.message : "Unknown storage error"
      }));
    }
  }

  return { objectsArchived, assetsArchived, freedBytes, failed };
}

export async function advanceEntitlementLifecycle(now = new Date()): Promise<{ updated: number; purged: number }> {
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const expired = await db
    .select({ workspaceId: entitlements.workspaceId, status: entitlements.status, expiredAt: entitlements.expiredAt })
    .from(entitlements)
    .where(isNotNull(entitlements.expiredAt));
  let updated = 0;
  let purged = 0;
  for (const item of expired) {
    const decision = evaluateEntitlement(false, item.expiredAt, now);
    if (decision.shouldPurge) {
      await deletePrefix(`${item.workspaceId}/`);
      await db.delete(workspaces).where(eq(workspaces.id, item.workspaceId));
      purged += 1;
      continue;
    }
    if (decision.status !== item.status) {
      await db.update(entitlements).set({ status: decision.status, updatedAt: now }).where(eq(entitlements.workspaceId, item.workspaceId));
      updated += 1;
    }
  }
  return { updated, purged };
}

/** One concise in-app recap per day for automatic workspaces, instead of one alert per post. */
export async function createAutomaticPublishDigest(now = new Date()): Promise<number> {
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const since = new Date(now.getTime() - DAY_MS);
  const dayLabel = now.toISOString().slice(0, 10);
  const title = `Ringkasan penerbitan ${dayLabel}`;
  const automaticWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.publicationMode, "AUTOMATIC"));
  let created = 0;
  for (const workspace of automaticWorkspaces) {
    const [alreadyCreated, summary] = await Promise.all([
      db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.workspaceId, workspace.id), eq(notifications.title, title)))
        .limit(1),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(publishJobs)
        .where(and(eq(publishJobs.workspaceId, workspace.id), eq(publishJobs.status, "SUCCEEDED"), gte(publishJobs.updatedAt, since)))
    ]);
    const published = summary[0]?.value ?? 0;
    if (alreadyCreated.length > 0 || published === 0) continue;
    await db.insert(notifications).values({
      workspaceId: workspace.id,
      kind: "EXPORT_READY",
      title,
      body: `${published} konten berhasil diterbitkan dalam 24 jam terakhir.`,
      actionUrl: "/calendar"
    });
    created += 1;
  }
  return created;
}
