import { and, eq, ne } from "drizzle-orm";
import {
  auditEvents,
  socialConnections,
  withTenant,
  type Database,
  type TenantTransaction
} from "@routie/db";
import type { SocialChannel } from "@routie/domain";
import { encryptSecret } from "@routie/security";
import type { InstagramProfile, MetaPageAccount, ThreadsProfile } from "./meta-oauth";
import { accountLabel } from "./meta-oauth";

type ConnectionInput = {
  channel: SocialChannel;
  deliveryMode?: "AUTO_PUBLISH" | "PLATFORM_DRAFT" | "EXPORT_MANUAL";
  externalAccountId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date | null;
};

async function replaceChannelConnection(
  tx: TenantTransaction,
  workspaceId: string,
  actorId: string,
  masterKey: string,
  input: ConnectionInput
): Promise<void> {
  const now = new Date();
  await tx
    .update(socialConnections)
    .set({ disconnectedAt: now, updatedAt: now })
    .where(
      and(
        eq(socialConnections.workspaceId, workspaceId),
        eq(socialConnections.channel, input.channel),
        ne(socialConnections.externalAccountId, input.externalAccountId)
      )
    );

  const encryptedAccessToken = encryptSecret(
    input.accessToken,
    masterKey,
    `${workspaceId}:${input.channel}:access-token`
  );
  const encryptedRefreshToken = input.refreshToken
    ? encryptSecret(input.refreshToken, masterKey, `${workspaceId}:${input.channel}:refresh-token`)
    : null;

  await tx
    .insert(socialConnections)
    .values({
      workspaceId,
      channel: input.channel,
      deliveryMode: input.deliveryMode ?? "AUTO_PUBLISH",
      externalAccountId: input.externalAccountId,
      accountName: input.accountName,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenExpiresAt: input.tokenExpiresAt,
      reauthorizationRequiredAt: null,
      reauthorizationReason: null,
      connectedAt: now,
      disconnectedAt: null
    })
    .onConflictDoUpdate({
      target: [socialConnections.workspaceId, socialConnections.channel, socialConnections.externalAccountId],
      set: {
        deliveryMode: input.deliveryMode ?? "AUTO_PUBLISH",
        accountName: input.accountName,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
        reauthorizationRequiredAt: null,
        reauthorizationReason: null,
        connectedAt: now,
        disconnectedAt: null,
        updatedAt: now
      }
    });

  await tx.insert(auditEvents).values({
    workspaceId,
    actorId,
    action: "SOCIAL_ACCOUNT_CONNECTED",
    entityType: "social_connection",
    entityId: input.externalAccountId,
    after: {
      channel: input.channel,
      accountName: input.accountName,
      tokenExpiresAt: input.tokenExpiresAt?.toISOString() ?? null
    }
  });
}

export async function persistMetaPageConnections(input: {
  db: Database;
  workspaceId: string;
  actorId: string;
  masterKey: string;
  page: MetaPageAccount;
  instagramProfile?: InstagramProfile;
  tokenExpiresAt: Date | null;
}): Promise<{ facebook: string; instagram: string | null }> {
  const facebookName = input.page.name;
  const instagramName = input.instagramProfile
    ? accountLabel(input.instagramProfile.name, input.instagramProfile.username, "Instagram Professional")
    : null;

  await withTenant(input.db, input.workspaceId, async (tx) => {
    await replaceChannelConnection(tx, input.workspaceId, input.actorId, input.masterKey, {
      channel: "FACEBOOK",
      externalAccountId: input.page.id,
      accountName: facebookName,
      accessToken: input.page.access_token,
      tokenExpiresAt: input.tokenExpiresAt
    });
    if (input.instagramProfile) {
      await replaceChannelConnection(tx, input.workspaceId, input.actorId, input.masterKey, {
        channel: "INSTAGRAM",
        externalAccountId: input.instagramProfile.id,
        accountName: instagramName!,
        accessToken: input.page.access_token,
        tokenExpiresAt: input.tokenExpiresAt
      });
    }
  });
  return { facebook: facebookName, instagram: instagramName };
}

export async function persistThreadsConnection(input: {
  db: Database;
  workspaceId: string;
  actorId: string;
  masterKey: string;
  profile: ThreadsProfile;
  accessToken: string;
  tokenExpiresAt: Date;
}): Promise<string> {
  const accountName = accountLabel(input.profile.name, input.profile.username, "Threads Account");
  await withTenant(input.db, input.workspaceId, (tx) =>
    replaceChannelConnection(tx, input.workspaceId, input.actorId, input.masterKey, {
      channel: "THREADS",
      externalAccountId: input.profile.id,
      accountName,
      accessToken: input.accessToken,
      // Threads refreshes a long-lived access token with that same token.
      refreshToken: input.accessToken,
      tokenExpiresAt: input.tokenExpiresAt
    })
  );
  return accountName;
}

/**
 * TikTok starts in Draft Sync mode. Direct Post is deliberately enabled only
 * after Routie's TikTok review and its per-post consent UI are live.
 */
export async function persistTikTokConnection(input: {
  db: Database;
  workspaceId: string;
  actorId: string;
  masterKey: string;
  openId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date;
}): Promise<string> {
  await withTenant(input.db, input.workspaceId, (tx) =>
    replaceChannelConnection(tx, input.workspaceId, input.actorId, input.masterKey, {
      channel: "TIKTOK",
      deliveryMode: "PLATFORM_DRAFT",
      externalAccountId: input.openId,
      accountName: input.accountName,
      accessToken: input.accessToken,
      ...(input.refreshToken ? { refreshToken: input.refreshToken } : {}),
      tokenExpiresAt: input.tokenExpiresAt
    })
  );
  return input.accountName;
}
