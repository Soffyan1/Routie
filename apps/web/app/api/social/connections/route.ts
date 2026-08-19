import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createDatabase, socialConnections, withTenant } from "@routie/db";
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
    const db = createDatabase(serverEnv().DATABASE_URL);
    const connections = await withTenant(db, session.workspaceId, async (tx) => {
      return tx
        .select()
        .from(socialConnections)
        .where(eq(socialConnections.workspaceId, session.workspaceId));
    });

    const now = new Date();
    const result = CHANNELS.map((ch) => {
      const conn = connections.find((c) => c.channel === ch.id && !c.disconnectedAt);
      const isConnected = Boolean(conn);
      const tokenExpiresAt = conn?.tokenExpiresAt;
      const isExpiringSoon = tokenExpiresAt
        ? new Date(tokenExpiresAt).getTime() - now.getTime() < 3 * 24 * 3600 * 1000 && new Date(tokenExpiresAt).getTime() > now.getTime()
        : false;
      const isExpired = tokenExpiresAt ? new Date(tokenExpiresAt).getTime() <= now.getTime() : false;

      return {
        id: ch.id,
        name: ch.name,
        initial: ch.initial,
        desc: ch.desc,
        defaultMode: ch.mode,
        supported: ch.supported,
        isConnected,
        accountName: conn?.accountName || null,
        deliveryMode: conn?.deliveryMode || "AUTO_PUBLISH",
        tokenExpiresAt: conn?.tokenExpiresAt || null,
        isExpiringSoon,
        isExpired,
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
  action: z.enum(["connect", "disconnect", "update_mode"]),
  accountName: z.string().optional(),
  deliveryMode: z.enum(["AUTO_PUBLISH", "PLATFORM_DRAFT", "EXPORT_MANUAL"]).optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "OWNER" && session.role !== "EDITOR") {
      throw new Error("Only owners or editors can manage social connections");
    }

    const input = toggleSchema.parse(await request.json());
    const db = createDatabase(serverEnv().DATABASE_URL);

    await withTenant(db, session.workspaceId, async (tx) => {
      if (input.action === "disconnect") {
        await tx
          .update(socialConnections)
          .set({ disconnectedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(socialConnections.workspaceId, session.workspaceId), eq(socialConnections.channel, input.channel)));
      } else if (input.action === "connect") {
        const fakeExpiry = new Date(Date.now() + 60 * 24 * 3600 * 1000); // 60 days
        const accountName = input.accountName || `@${session.email.split("@")[0]}_official`;
        const existing = await tx
          .select()
          .from(socialConnections)
          .where(and(eq(socialConnections.workspaceId, session.workspaceId), eq(socialConnections.channel, input.channel)))
          .limit(1);

        if (existing[0]) {
          await tx
            .update(socialConnections)
            .set({
              disconnectedAt: null,
              accountName,
              tokenExpiresAt: fakeExpiry,
              updatedAt: new Date()
            })
            .where(eq(socialConnections.id, existing[0].id));
        } else {
          await tx.insert(socialConnections).values({
            workspaceId: session.workspaceId,
            channel: input.channel,
            deliveryMode: input.deliveryMode || "AUTO_PUBLISH",
            externalAccountId: `ext_${Date.now()}`,
            accountName,
            tokenExpiresAt: fakeExpiry,
            connectedAt: new Date()
          });
        }
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
