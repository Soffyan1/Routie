import { and, eq } from "drizzle-orm";
import {
  channelVariants,
  contentConcepts,
  createDatabase,
  entitlements,
  mediaAssets,
  memberships,
  notificationPreferences,
  notifications,
  publishAttempts,
  publishJobs,
  socialConnections,
  users,
  workspaces
} from "@routie/db";
import type { NormalizedError, PublishRequest } from "@routie/domain";
import { getSocialPublisher, PublishRequestError } from "@routie/publishers";
import {
  decryptSecret,
  encryptSecret,
  GoogleOAuthError,
  refreshGoogleAccessToken,
  refreshThreadsAccessToken,
  refreshTikTokAccessToken,
  ThreadsOAuthError,
  TikTokOAuthError,
  tokenNeedsRefresh
} from "@routie/security";
import { createDownloadUrl } from "@routie/storage";
import { sendPublishEmail } from "./email";
import type { PublishQueuePayload } from "./queues";

function objectUrl(objectKey: string): string {
  const publicBase = process.env.S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT ?? "http://localhost:9000"}/${process.env.S3_BUCKET ?? "routie"}`;
  return `${publicBase.replace(/\/$/, "")}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}

function tiktokObjectUrl(objectKey: string): string | null {
  const prefix = process.env.TIKTOK_MEDIA_URL_PREFIX?.replace(/\/$/, "");
  if (!prefix) return null;
  return `${prefix}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizedError(error: unknown): NormalizedError {
  if (error instanceof ReauthorizationRequiredError) return error.normalized;
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

class ReauthorizationRequiredError extends Error {
  readonly normalized: NormalizedError;

  constructor(channel: string) {
    super(`${channel} perlu disambungkan kembali agar publikasi dapat dilanjutkan.`);
    this.name = "ReauthorizationRequiredError";
    this.normalized = {
      code: "SOCIAL_RECONNECT_REQUIRED",
      message: this.message,
      retryable: false,
      provider: channel
    };
  }
}

export async function processPublish(payload: PublishQueuePayload): Promise<void> {
  const db = createDatabase(process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_URL);
  const prepared = await db.transaction(async (tx) => {
    await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
    const [row] = await tx
      .select({ job: publishJobs, variant: channelVariants, connection: socialConnections, entitlement: entitlements, workspace: workspaces })
      .from(publishJobs)
      .innerJoin(channelVariants, eq(channelVariants.id, publishJobs.variantId))
      .leftJoin(socialConnections, eq(socialConnections.id, publishJobs.connectionId))
      .innerJoin(entitlements, eq(entitlements.workspaceId, publishJobs.workspaceId))
      .innerJoin(workspaces, eq(workspaces.id, publishJobs.workspaceId))
      .where(and(eq(publishJobs.id, payload.publishJobId), eq(publishJobs.workspaceId, payload.workspaceId)))
      .limit(1);
    if (!row) throw new Error("Publish job was not found in this workspace");
    if (["SUCCEEDED", "HELD", "CANCELED"].includes(row.job.status)) return null;
    if (row.entitlement.status !== "ACTIVE") {
      await tx.update(publishJobs).set({ status: "HELD", heldReason: `ENTITLEMENT_${row.entitlement.status}`, updatedAt: new Date() }).where(eq(publishJobs.id, row.job.id));
      return null;
    }
    if (row.connection?.reauthorizationRequiredAt) {
      await tx.update(publishJobs).set({ status: "HELD", heldReason: "SOCIAL_RECONNECT_REQUIRED", updatedAt: new Date() }).where(eq(publishJobs.id, row.job.id));
      return null;
    }
    if (
      row.variant.channel === "TIKTOK" &&
      (row.connection?.deliveryMode !== "PLATFORM_DRAFT" || process.env.ENABLE_TIKTOK_DRAFT_SYNC !== "true")
    ) {
      // While TikTok is under review (or Direct Post consent UI is unavailable),
      // preserve the schedule and media instead of exporting a misleading file
      // or repeatedly failing a real user job.
      await tx
        .update(publishJobs)
        .set({ status: "HELD", heldReason: "TIKTOK_DRAFT_SYNC_PENDING", updatedAt: new Date() })
        .where(eq(publishJobs.id, row.job.id));
      return null;
    }
    if (row.connection?.tokenExpiresAt && tokenNeedsRefresh(row.connection.tokenExpiresAt) && !row.connection.encryptedRefreshToken) {
      await tx.update(socialConnections).set({ reauthorizationRequiredAt: new Date(), reauthorizationReason: "missing_refresh_token", updatedAt: new Date() }).where(eq(socialConnections.id, row.connection.id));
      await tx.update(publishJobs).set({ status: "HELD", heldReason: "SOCIAL_RECONNECT_REQUIRED", updatedAt: new Date() }).where(eq(publishJobs.id, row.job.id));
      await tx.insert(notifications).values({
        workspaceId: payload.workspaceId,
        kind: "TOKEN_EXPIRED",
        title: `${row.variant.channel} perlu disambungkan kembali`,
        body: `Sambungkan kembali akun ${row.variant.channel} agar publikasi terjadwal dapat dilanjutkan.`,
        actionUrl: "/settings/connectors"
      });
      return null;
    }
    const assets = await tx.select().from(mediaAssets).where(eq(mediaAssets.variantId, row.variant.id));
    const attemptNumber = row.job.attemptCount + 1;
    const [attempt] = await tx
      .insert(publishAttempts)
      .values({ workspaceId: payload.workspaceId, jobId: row.job.id, attemptNumber })
      .returning();
    await tx.update(publishJobs).set({ status: "PROCESSING", attemptCount: attemptNumber, updatedAt: new Date() }).where(eq(publishJobs.id, row.job.id));
    await tx
      .update(contentConcepts)
      .set({ state: "PUBLISHING", heldReason: null, updatedAt: new Date() })
      .where(and(eq(contentConcepts.id, row.variant.conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
    return { ...row, assets, attemptId: attempt!.id, attemptNumber };
  });

  if (!prepared) return;
  const publisher = getSocialPublisher(prepared.variant.channel);
  const mediaUrls = await Promise.all(
    prepared.assets.map(async (asset) => {
      // TikTok pulls media from its own servers. It must receive the verified,
      // durable public URL rather than a short-lived private download URL.
      if (prepared.variant.channel === "TIKTOK") return tiktokObjectUrl(asset.objectKey) ?? objectUrl(asset.objectKey);
      try {
        return await createDownloadUrl(asset.objectKey, 3600);
      } catch {
        return objectUrl(asset.objectKey);
      }
    })
  );
  const request: PublishRequest = {
    connectionId: prepared.connection?.id ?? `export:${prepared.variant.channel}`,
    channel: prepared.variant.channel,
    externalAccountId: prepared.connection?.externalAccountId ?? "manual-export",
    deliveryMode: prepared.connection?.deliveryMode ?? prepared.variant.deliveryMode,
    caption: prepared.variant.caption,
    mediaUrls,
    contentKind: prepared.variant.contentKind,
    scheduledFor: prepared.job.scheduledFor,
    idempotencyKey: prepared.job.idempotencyKey
  };
  let token: string | null = null;
  if (prepared.connection?.encryptedAccessToken) {
    const masterKey = process.env.ENVELOPE_MASTER_KEY;
    if (!masterKey) throw new Error("ENVELOPE_MASTER_KEY is required by the worker");
    // Decrypt existing access token
    const currentAccess = decryptSecret(
      prepared.connection.encryptedAccessToken,
      masterKey,
      `${payload.workspaceId}:${prepared.variant.channel}:access-token`
    );
    // If token expired, attempt refresh using refresh token
    const now = new Date();
    const expiresAt = prepared.connection.tokenExpiresAt ? new Date(prepared.connection.tokenExpiresAt) : null;
    if (prepared.variant.channel === "YOUTUBE" && tokenNeedsRefresh(expiresAt, now)) {
      // Need refresh token
      if (!prepared.connection.encryptedRefreshToken) {
        throw new ReauthorizationRequiredError(prepared.variant.channel);
      }
      const refreshToken = decryptSecret(
        prepared.connection.encryptedRefreshToken,
        masterKey,
        `${payload.workspaceId}:${prepared.variant.channel}:refresh-token`
      );
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error("Google OAuth client credentials not set in environment");
      }
      let refreshed;
      try {
        refreshed = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
      } catch (error) {
        if (error instanceof GoogleOAuthError && error.permanent) {
          await db.transaction(async (tx) => {
            await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
            await tx.update(socialConnections).set({ reauthorizationRequiredAt: new Date(), reauthorizationReason: error.code, updatedAt: new Date() }).where(eq(socialConnections.id, prepared.connection!.id));
          });
          throw new ReauthorizationRequiredError(prepared.variant.channel);
        }
        throw error;
      }
      const newAccess = refreshed.accessToken;
      // Encrypt and store new access token
      const encryptedAccess = encryptSecret(
        newAccess,
        masterKey,
        `${payload.workspaceId}:${prepared.variant.channel}:access-token`
      );
      await db.transaction(async (tx) => {
        await tx
          .update(socialConnections)
          .set({
            encryptedAccessToken: encryptedAccess,
            tokenExpiresAt: refreshed.expiresAt,
            updatedAt: new Date()
          })
          .where(eq(socialConnections.id, prepared.connection!.id));
      });
      token = newAccess;
    } else if (prepared.variant.channel === "THREADS" && tokenNeedsRefresh(expiresAt, now, 7 * 24 * 60 * 60_000)) {
      if (!prepared.connection.encryptedRefreshToken) {
        throw new ReauthorizationRequiredError("THREADS");
      }
      const refreshToken = decryptSecret(
        prepared.connection.encryptedRefreshToken,
        masterKey,
        `${payload.workspaceId}:THREADS:refresh-token`
      );
      let refreshed;
      try {
        refreshed = await refreshThreadsAccessToken(refreshToken);
      } catch (error) {
        if (error instanceof ThreadsOAuthError && error.permanent) {
          await db.transaction(async (tx) => {
            await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
            await tx
              .update(socialConnections)
              .set({
                reauthorizationRequiredAt: new Date(),
                reauthorizationReason: error.code,
                updatedAt: new Date()
              })
              .where(eq(socialConnections.id, prepared.connection!.id));
          });
          throw new ReauthorizationRequiredError("THREADS");
        }
        throw error;
      }
      const encryptedAccess = encryptSecret(
        refreshed.accessToken,
        masterKey,
        `${payload.workspaceId}:THREADS:access-token`
      );
      const encryptedRefresh = encryptSecret(
        refreshed.accessToken,
        masterKey,
        `${payload.workspaceId}:THREADS:refresh-token`
      );
      await db.transaction(async (tx) => {
        await tx
          .update(socialConnections)
          .set({
            encryptedAccessToken: encryptedAccess,
            encryptedRefreshToken: encryptedRefresh,
            tokenExpiresAt: refreshed.expiresAt,
            updatedAt: new Date()
          })
          .where(eq(socialConnections.id, prepared.connection!.id));
      });
      token = refreshed.accessToken;
    } else if (prepared.variant.channel === "TIKTOK" && tokenNeedsRefresh(expiresAt, now, 30 * 60_000)) {
      if (!prepared.connection.encryptedRefreshToken) {
        throw new ReauthorizationRequiredError("TIKTOK");
      }
      const refreshToken = decryptSecret(
        prepared.connection.encryptedRefreshToken,
        masterKey,
        `${payload.workspaceId}:TIKTOK:refresh-token`
      );
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
      if (!clientKey || !clientSecret) throw new Error("TikTok OAuth client credentials not set in environment");
      let refreshed;
      try {
        refreshed = await refreshTikTokAccessToken(refreshToken, clientKey, clientSecret);
      } catch (error) {
        if (error instanceof TikTokOAuthError && error.permanent) {
          await db.transaction(async (tx) => {
            await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
            await tx
              .update(socialConnections)
              .set({ reauthorizationRequiredAt: new Date(), reauthorizationReason: error.code, updatedAt: new Date() })
              .where(eq(socialConnections.id, prepared.connection!.id));
          });
          throw new ReauthorizationRequiredError("TIKTOK");
        }
        throw error;
      }
      await db.transaction(async (tx) => {
        await tx
          .update(socialConnections)
          .set({
            encryptedAccessToken: encryptSecret(refreshed.accessToken, masterKey, `${payload.workspaceId}:TIKTOK:access-token`),
            encryptedRefreshToken: encryptSecret(refreshed.refreshToken, masterKey, `${payload.workspaceId}:TIKTOK:refresh-token`),
            tokenExpiresAt: refreshed.expiresAt,
            updatedAt: new Date()
          })
          .where(eq(socialConnections.id, prepared.connection!.id));
      });
      token = refreshed.accessToken;
    } else {
      token = currentAccess;
    }
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
      const conceptJobs = await tx
        .select({ status: publishJobs.status })
        .from(publishJobs)
        .innerJoin(channelVariants, eq(channelVariants.id, publishJobs.variantId))
        .where(and(eq(publishJobs.workspaceId, payload.workspaceId), eq(channelVariants.conceptId, prepared.variant.conceptId)));
      if (conceptJobs.length > 0 && conceptJobs.every((job) => job.status === "SUCCEEDED")) {
        await tx
          .update(contentConcepts)
          .set({ state: "PUBLISHED", heldReason: null, updatedAt: new Date() })
          .where(and(eq(contentConcepts.id, prepared.variant.conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
      }
      if (prepared.workspace.publicationMode !== "AUTOMATIC") {
        const deliveredAsDraft = prepared.variant.channel === "TIKTOK" && prepared.connection?.deliveryMode === "PLATFORM_DRAFT";
        await tx.insert(notifications).values({
          workspaceId: payload.workspaceId,
          kind: "EXPORT_READY",
          title: deliveredAsDraft ? "Draft TikTok Siap Dilanjutkan" : `Konten Berhasil Terbit ke ${prepared.variant.channel}!`,
          body: deliveredAsDraft
            ? `Video "${prepared.variant.caption.slice(0, 70)}" sudah dikirim ke inbox TikTok. Buka TikTok untuk menyelesaikan edit dan publikasi.`
            : `Postingan "${prepared.variant.caption.slice(0, 70)}" telah berhasil dipublikasikan.`,
          actionUrl: result.externalUrl || "/calendar"
        });
      }
    });

    // Mode Otomatis merangkum keberhasilan agar user tidak menerima spam notifikasi per konten.
    if (prepared.workspace.publicationMode !== "AUTOMATIC") try {
      const recipients = await db.transaction(async (tx) => {
        await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
        return tx
          .select({
            email: users.email,
            name: users.name,
            emailNotifications: notificationPreferences.emailNotifications
          })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .leftJoin(
            notificationPreferences,
            and(
              eq(notificationPreferences.workspaceId, memberships.workspaceId),
              eq(notificationPreferences.userId, memberships.userId)
            )
          )
          .where(eq(memberships.workspaceId, payload.workspaceId));
      });

      for (const recipient of recipients) {
        if (recipient.emailNotifications === false) continue;
        await sendPublishEmail({
          toEmail: recipient.email,
          userName: recipient.name || "Creator",
          channel: prepared.variant.channel,
          accountName: prepared.connection?.accountName,
          caption: prepared.variant.caption,
          externalUrl: result.externalUrl,
          status: "SUCCEEDED",
          scheduledTime: prepared.job.scheduledFor
        });
      }
    } catch (emailErr) {
      console.error("[Worker] Failed to dispatch success notification email:", emailErr);
    }
  } catch (error) {
    const normalized = normalizedError(error);
    await db.transaction(async (tx) => {
      await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
      const requiresReconnect = error instanceof ReauthorizationRequiredError || normalized.code === "SOCIAL_TOKEN_INVALID";
      const willRetry = !requiresReconnect && normalized.retryable && prepared.attemptNumber < 3;
      if (requiresReconnect && prepared.connection) {
        await tx
          .update(socialConnections)
          .set({
            reauthorizationRequiredAt: new Date(),
            reauthorizationReason: normalized.code,
            updatedAt: new Date()
          })
          .where(eq(socialConnections.id, prepared.connection.id));
      }
      await tx.update(publishAttempts).set({ completedAt: new Date(), outcome: normalized.code === "PUBLISH_PROCESSING" ? "PROCESSING" : "FAILED", sanitizedResponse: { ...normalized } }).where(eq(publishAttempts.id, prepared.attemptId));
      await tx.update(publishJobs).set({ status: requiresReconnect ? "HELD" : willRetry ? "QUEUED" : "FAILED", heldReason: requiresReconnect ? "SOCIAL_RECONNECT_REQUIRED" : null, lastError: { ...normalized }, updatedAt: new Date() }).where(eq(publishJobs.id, prepared.job.id));
      if (requiresReconnect || !willRetry) {
        await tx
          .update(contentConcepts)
          .set({
            state: requiresReconnect ? "HELD" : "FAILED",
            heldReason: requiresReconnect
              ? `Sambungkan ulang ${prepared.variant.channel} agar publikasi dapat dilanjutkan.`
              : "Konten belum dapat diterbitkan. Routie sudah mencoba kembali secara aman."
            ,
            updatedAt: new Date()
          })
          .where(and(eq(contentConcepts.id, prepared.variant.conceptId), eq(contentConcepts.workspaceId, payload.workspaceId)));
      }
      if (!willRetry) {
        await tx.insert(notifications).values({
          workspaceId: payload.workspaceId,
          kind: requiresReconnect ? "TOKEN_EXPIRED" : "PUBLISH_FAILED",
          title: requiresReconnect ? `${prepared.variant.channel} perlu disambungkan kembali` : `Penerbitan Konten ke ${prepared.variant.channel} Gagal`,
          body: requiresReconnect ? `Sambungkan kembali akun ${prepared.variant.channel} agar publikasi terjadwal dapat dilanjutkan.` : normalized.message || "Terjadi kendala saat menerbitkan postingan.",
          actionUrl: requiresReconnect ? "/settings/connectors" : "/calendar"
        });
      }
    });

    if ((!normalized.retryable || prepared.attemptNumber >= 3) && !(error instanceof ReauthorizationRequiredError)) {
      try {
        const recipients = await db.transaction(async (tx) => {
          await tx.execute(`select set_config('app.workspace_id', '${payload.workspaceId.replaceAll("'", "")}', true)`);
          return tx
            .select({
              email: users.email,
              name: users.name,
              emailNotifications: notificationPreferences.emailNotifications,
              publishFailed: notificationPreferences.publishFailed
            })
            .from(memberships)
            .innerJoin(users, eq(users.id, memberships.userId))
            .leftJoin(
              notificationPreferences,
              and(
                eq(notificationPreferences.workspaceId, memberships.workspaceId),
                eq(notificationPreferences.userId, memberships.userId)
              )
            )
            .where(eq(memberships.workspaceId, payload.workspaceId));
        });

        for (const recipient of recipients) {
          if (recipient.emailNotifications === false || recipient.publishFailed === false) continue;
          await sendPublishEmail({
            toEmail: recipient.email,
            userName: recipient.name || "Creator",
            channel: prepared.variant.channel,
            accountName: prepared.connection?.accountName,
            caption: prepared.variant.caption,
            status: "FAILED",
            errorMessage: normalized.message,
            scheduledTime: prepared.job.scheduledFor
          });
        }
      } catch (emailErr) {
        console.error("[Worker] Failed to dispatch failure notification email:", emailErr);
      }
    }

    if (normalized.retryable && prepared.attemptNumber < 3) throw error;
  }
}
