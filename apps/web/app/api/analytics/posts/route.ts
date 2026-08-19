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
    const search = (url.searchParams.get("search") || "").toLowerCase().trim();
    const sortBy = url.searchParams.get("sort") || "publishedAt";
    const order = url.searchParams.get("order") || "desc";

    const { posts } = await fetchWorkspaceAnalytics(session.workspaceId, period, channel);

    let filtered = posts;
    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.postTitle.toLowerCase().includes(search) ||
          (p.postCaption && p.postCaption.toLowerCase().includes(search))
      );
    }

    filtered.sort((a, b) => {
      let valA: any = (a as any)[sortBy] ?? 0;
      let valB: any = (b as any)[sortBy] ?? 0;
      if (typeof valA === "string") valA = new Date(valA).getTime();
      if (typeof valB === "string") valB = new Date(valB).getTime();
      return order === "desc" ? valB - valA : valA - valB;
    });

    return NextResponse.json({
      success: true,
      count: filtered.length,
      posts: filtered
    });
  } catch (error) {
    console.error("GET /api/analytics/posts error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
