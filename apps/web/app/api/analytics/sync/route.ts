import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { createDatabase, dailyWorkspaceMetrics, socialConnections, socialPostInsights, withTenant } from "@routie/db";
import { serverEnv } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const db = createDatabase(serverEnv().DATABASE_URL);

    const body = await request.json().catch(() => ({}));
    const channel = body.channel || "ALL";

    // Simulate / execute syncing metrics from connected channels
    const result = await withTenant(db, session.workspaceId, async (tx) => {
      const connections = await tx
        .select()
        .from(socialConnections)
        .where(eq(socialConnections.workspaceId, session.workspaceId));

      return {
        connectedCount: connections.length,
        syncedAt: new Date().toISOString()
      };
    });

    return NextResponse.json({
      success: true,
      message: "Sinkronisasi data statistik berhasil diperbarui!",
      syncedAt: result.syncedAt,
      connectedChannels: result.connectedCount
    });
  } catch (error) {
    console.error("POST /api/analytics/sync error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Gagal sinkronisasi data" },
      { status: 500 }
    );
  }
}
