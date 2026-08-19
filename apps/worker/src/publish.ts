import { and, eq } from "drizzle-orm";
import {
  channelVariants,
  createDatabase,
  entitlements,
  mediaAssets,
  publishAttempts,
  publishJobs,
  socialConnections
} from "@routie/db";
import type { NormalizedError, PublishRequest } from "@routie/domain";
import { getSocialPublisher, PublishRequestError } from "@routie/publishers";
import { decryptSecret } from "@routie/security";
import type { PublishQueuePayload } from "./queues";

function objectUrl(objectKey: string): string {
  const publicBase = process.env.S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT ?? "http://localhost:9000"}/${process.env.S3_BUCKET ?? "routie"}`;
  return `${publicBase.replace(/\/$/, "")}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizedError(error: unknown): NormalizedError {
  if (error instanceof PublishRequestError) return error.normalized;
  return {
    code: "UNEXPECTED_PUBLISH_ERROR",
    message: error instanceof Error ? error.message : "Unknown publishing error",
    retryable: false
  };
}

function pendingError(provider: string): PublishRequestError {
  return new PublishRequestError({ code: "PUBLISH_PROCESSING", message: `${provider} is still processing the post`, retryable: true, provider });
}

export async function processPublish(payload: PublishQueuePayload): Promise<void> {
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const prepared = await db.transaction(async (tx) => {
    await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
    const [row] = await tx
      .select({ job: publishJobs, variant: channelVariants, connection: socialConnections, entitlement: entitlements })
      .from(publishJobs)
      .innerJoin(channelVariants, eq(channelVariants.id, publishJobs.variantId))
      .leftJoin(socialConnections, eq(socialConnections.id, publishJobs.connectionId))
      .innerJoin(entitlements, eq(entitlements.workspaceId, publishJobs.workspaceId))
      .where(and(eq(publishJobs.id, payload.publishJobId), eq(publishJobs.workspaceId, payload.workspaceId)))
      .limit(1);
    if (!row) throw new Error("Publish job was not found in this workspace");
    if (row.job.status === "SUCCEEDED") return null;
    if (row.entitlement.status !== "ACTIVE") {
      await tx.update(publishJobs).set({ status: "HELD", heldReason: `ENTITLEMENT_${row.entitlement.status}`, updatedAt: new Date() }).where(eq(publishJobs.id, row.job.id));
      return null;
    }
    if (row.connection?.tokenExpiresAt && row.connection.tokenExpiresAt <= new Date()) {
      await tx.update(publishJobs).set({ status: "HELD", heldReason: "SOCIAL_TOKEN_EXPIRED", updatedAt: new Date() }).where(eq(publishJobs.id, row.job.id));
      return null;
    }
    const assets = await tx.select().from(mediaAssets).where(eq(mediaAssets.variantId, row.variant.id));
    const attemptNumber = row.job.attemptCount + 1;
    const [attempt] = await tx
      .insert(publishAttempts)
      .values({ workspaceId: payload.workspaceId, jobId: row.job.id, attemptNumber })
      .returning();
    await tx.update(publishJobs).set({ status: "PROCESSING", attemptCount: attemptNumber, updatedAt: new Date() }).where(eq(publishJobs.id, row.job.id));
    return { ...row, assets, attemptId: attempt!.id, attemptNumber };
  });

  if (!prepared) return;
  const publisher = getSocialPublisher(prepared.variant.channel);
  const request: PublishRequest = {
    connectionId: prepared.connection?.id ?? `export:${prepared.variant.channel}`,
    channel: prepared.variant.channel,
    externalAccountId: prepared.connection?.externalAccountId ?? "manual-export",
    caption: prepared.variant.caption,
    mediaUrls: prepared.assets.map((asset) => objectUrl(asset.objectKey)),
    contentKind: prepared.variant.contentKind,
    scheduledFor: prepared.job.scheduledFor,
    idempotencyKey: prepared.job.idempotencyKey
  };
  let token: string | null = null;
  if (prepared.connection?.encryptedAccessToken) {
    const masterKey = process.env.ENVELOPE_MASTER_KEY;
    if (!masterKey) throw new Error("ENVELOPE_MASTER_KEY is required by the worker");
    token = decryptSecret(
      prepared.connection.encryptedAccessToken,
      masterKey,
      `${payload.workspaceId}:${prepared.variant.channel}:access-token`
    );
  }

  try {
    const result = prepared.job.providerJobId && publisher.reconcile && token
      ? await publisher.reconcile(token, prepared.job.providerJobId)
      : await publisher.publish(token, request);
    if (result.status === "PROCESSING") {
      await db.transaction(async (tx) => {
        await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
        await tx.update(publishJobs).set({ status: "QUEUED", providerJobId: result.providerJobId, updatedAt: new Date() }).where(eq(publishJobs.id, prepared.job.id));
      });
      throw pendingError(prepared.variant.channel);
    }
    await db.transaction(async (tx) => {
      await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
      await tx.update(publishAttempts).set({ completedAt: new Date(), outcome: result.status, sanitizedResponse: { ...result } }).where(eq(publishAttempts.id, prepared.attemptId));
      await tx
        .update(publishJobs)
        .set({
          status: "SUCCEEDED",
          externalPostId: result.externalPostId,
          externalUrl: result.externalUrl,
          providerJobId: result.providerJobId,
          lastError: null,
          updatedAt: new Date()
        })
        .where(eq(publishJobs.id, prepared.job.id));
    });
  } catch (error) {
    const normalized = normalizedError(error);
    await db.transaction(async (tx) => {
      await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
      const willRetry = normalized.retryable && prepared.attemptNumber < 3;
      await tx.update(publishAttempts).set({ completedAt: new Date(), outcome: normalized.code === "PUBLISH_PROCESSING" ? "PROCESSING" : "FAILED", sanitizedResponse: { ...normalized } }).where(eq(publishAttempts.id, prepared.attemptId));
      await tx.update(publishJobs).set({ status: willRetry ? "QUEUED" : "FAILED", lastError: { ...normalized }, updatedAt: new Date() }).where(eq(publishJobs.id, prepared.job.id));
    });
    if (normalized.retryable && prepared.attemptNumber < 3) throw error;
  }
}
