import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { fetchWorkspaceAnalytics } from "@/lib/analytics";
import type { AnalyticsPeriod } from "@routie/domain";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const period = (url.searchParams.get("period") || "30d") as AnalyticsPeriod;
    const channel = url.searchParams.get("channel") || "ALL";

    const data = await fetchWorkspaceAnalytics(session.workspaceId, period, channel);

    return NextResponse.json({
      success: true,
      summary: data.summary,
      posts: data.posts
    });
  } catch (error) {
    console.error("GET /api/analytics/summary error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
