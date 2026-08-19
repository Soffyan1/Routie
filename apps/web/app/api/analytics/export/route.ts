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

    const { posts } = await fetchWorkspaceAnalytics(session.workspaceId, period, channel);

    const headers = [
      "ID",
      "Platform",
      "Judul / Topik",
      "Format",
      "Tanggal Tayang",
      "Views",
      "Reach",
      "Impresi",
      "Likes",
      "Comments",
      "Shares",
      "Saves",
      "Engagement Rate (%)",
      "Status Performa",
      "Link Postingan"
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = posts.map((p) => [
      escapeCsv(p.externalPostId || p.id),
      escapeCsv(p.channel),
      escapeCsv(p.postTitle),
      escapeCsv(p.mediaType),
      escapeCsv(new Date(p.publishedAt).toLocaleDateString("id-ID")),
      escapeCsv(p.viewsCount),
      escapeCsv(p.reachCount),
      escapeCsv(p.impressionsCount),
      escapeCsv(p.likesCount),
      escapeCsv(p.commentsCount),
      escapeCsv(p.sharesCount),
      escapeCsv(p.savesCount),
      escapeCsv(p.engagementRate.toFixed(2)),
      escapeCsv(p.performanceScore || "NORMAL"),
      escapeCsv(p.postUrl || "-")
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const filename = `routie-analytics-${period}-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error("GET /api/analytics/export error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Gagal mengunduh CSV" },
      { status: 500 }
    );
  }
}
