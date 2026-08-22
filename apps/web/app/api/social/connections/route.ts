import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, createDatabase, socialConnections, withTenant } from "@routie/db";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

const CHANNELS = [
  { id: "INSTAGRAM", name: "Instagram", mode: "Direct Post / Reels", initial: "In", desc: "Meta Graph API (IG Professional & Creator)", supported: true },
  { id: "FACEBOOK", name: "Facebook", mode: "Page Post & Video", initial: "Fb", desc: "Meta Pages API Integration", supported: true },
  { id: "TIKTOK", name: "TikTok", mode: "Direct Post / Platform Draft", initial: "Tk", desc: "TikTok Content Posting API v2", supported: true },
  { id: "THREADS", name: "Threads", mode: "Official Threads API", initial: "Th", desc: "Meta Threads Publishing API", supported: true },
  { id: "YOUTUBE", name: "YouTube", mode: "Shorts Video Upload", initial: "Yt", desc: "Google YouTube Data API v3", supported: true },
  { id: "X", name: "X (Twitter)", mode: "Manual Asset Export", initial: "X", desc: "Export zip & scheduled draft mode", supported: false }
] as const;

export async function GET() {
  try {
    const session = await requireSession();
    const env = serverEnv();
    const db = createDatabase(env.DATABASE_URL);
    const connections = await withTenant(db, session.workspaceId, async (tx) => {
      return tx
        .select()
        .from(socialConnections)
        .where(eq(socialConnections.workspaceId, session.workspaceId));
    });

    const result = CHANNELS.map((ch) => {
      const conn =
        connections.find((c) => c.channel === ch.id && !c.disconnectedAt) ??
        connections.find((c) => c.channel === ch.id);
      const requiresReconnect = Boolean(conn?.reauthorizationRequiredAt);
      const isConnected = Boolean(conn?.encryptedAccessToken && !conn.disconnectedAt && !requiresReconnect);
      const status = requiresReconnect ? "RECONNECT_REQUIRED" : isConnected ? "CONNECTED" : "DISCONNECTED";

      return {
        id: ch.id,
        name: ch.name,
        initial: ch.initial,
        desc: ch.desc,
        defaultMode: ch.mode,
        supported: ch.supported,
        isConnected,
        status,
        requiresReconnect,
        accountName: conn?.accountName || null,
        deliveryMode: conn?.deliveryMode || "AUTO_PUBLISH",
        autoPublishEnabled:
          ch.id === "FACEBOOK" || ch.id === "INSTAGRAM"
            ? env.ENABLE_META_AUTO_PUBLISH === "true"
            : ch.id === "THREADS"
              ? env.ENABLE_THREADS_AUTO_PUBLISH === "true"
              : ch.id === "TIKTOK"
                ? env.ENABLE_TIKTOK_AUTO_PUBLISH === "true"
                : ch.id === "YOUTUBE"
                  ? env.ENABLE_YOUTUBE_AUTO_PUBLISH === "true"
                  : false,
        draftSyncEnabled: ch.id === "TIKTOK" && env.ENABLE_TIKTOK_DRAFT_SYNC === "true",
        connectedAt: conn?.connectedAt || null
      };
    });

    return NextResponse.json({ channels: result });
  } catch (error) {
    return apiError(error);
  }
}

const toggleSchema = z.object({
  channel: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "THREADS", "YOUTUBE", "X"]),
  action: z.enum(["disconnect", "update_mode"]),
  deliveryMode: z.enum(["AUTO_PUBLISH", "PLATFORM_DRAFT", "EXPORT_MANUAL"]).optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "OWNER" && session.role !== "EDITOR") {
      throw new Error("Only owners or editors can manage social connections");
    }

    const input = toggleSchema.parse(await request.json());
    if (
      input.action === "update_mode" &&
      (input.channel === "FACEBOOK" || input.channel === "INSTAGRAM" || input.channel === "THREADS") &&
      input.deliveryMode !== "AUTO_PUBLISH"
    ) {
      throw new Error("Mode publikasi Meta dikelola otomatis oleh Routie.");
    }
    if (input.action === "update_mode" && input.channel === "TIKTOK") {
      if (input.deliveryMode === "AUTO_PUBLISH") {
        throw new Error("Posting langsung TikTok memerlukan persetujuan per konten. Gunakan Draft TikTok untuk jadwal otomatis.");
      }
      if (input.deliveryMode === "PLATFORM_DRAFT" && serverEnv().ENABLE_TIKTOK_DRAFT_SYNC !== "true") {
        throw new Error("Draft TikTok akan aktif otomatis setelah integrasi Routie disetujui TikTok.");
      }
    }
    const db = createDatabase(serverEnv().DATABASE_URL);

    await withTenant(db, session.workspaceId, async (tx) => {
      if (input.action === "disconnect") {
        await tx
          .update(socialConnections)
          .set({
            encryptedAccessToken: null,
            encryptedRefreshToken: null,
            tokenExpiresAt: null,
            disconnectedAt: new Date(),
            reauthorizationRequiredAt: null,
            reauthorizationReason: null,
            updatedAt: new Date()
          })
          .where(and(eq(socialConnections.workspaceId, session.workspaceId), eq(socialConnections.channel, input.channel)));
        await tx.insert(auditEvents).values({
          workspaceId: session.workspaceId,
          actorId: session.sub,
          action: "SOCIAL_ACCOUNT_DISCONNECTED",
          entityType: "social_connection",
          entityId: input.channel,
          after: { channel: input.channel }
        });
      } else if (input.action === "update_mode" && input.deliveryMode) {
        await tx
          .update(socialConnections)
          .set({ deliveryMode: input.deliveryMode, updatedAt: new Date() })
          .where(and(eq(socialConnections.workspaceId, session.workspaceId), eq(socialConnections.channel, input.channel)));
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
