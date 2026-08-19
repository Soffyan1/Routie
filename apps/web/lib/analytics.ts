import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  contentConcepts,
  createDatabase,
  dailyWorkspaceMetrics,
  socialConnections,
  socialPostInsights,
  withTenant,
  workspaces
} from "@routie/db";
import type { AnalyticsPeriod, AnalyticsSummary, SocialPostInsight } from "@routie/domain";
import { serverEnv } from "./env";

function getDaysForPeriod(period: AnalyticsPeriod): number {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "1y":
      return 365;
    case "all":
    default:
      return 30;
  }
}

export function generateDemoAnalyticsData(workspaceName: string, period: AnalyticsPeriod, channelFilter: string): {
  summary: AnalyticsSummary;
  posts: SocialPostInsight[];
} {
  const daysCount = getDaysForPeriod(period);
  const now = new Date();

  // Generate date labels & trends
  const dailyTrends: AnalyticsSummary["dailyTrends"] = [];
  let baseReach = 1850;
  let baseImpressions = 2900;
  let baseEngagements = 145;

  let totalReach = 0;
  let totalImpressions = 0;
  let totalEngagements = 0;

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0]!;
    const dayOfWeek = d.toLocaleDateString("id-ID", { weekday: "short" });
    const dayNum = d.getDate();
    const monthStr = d.toLocaleDateString("id-ID", { month: "short" });
    const label = daysCount <= 14 ? `${dayOfWeek}, ${dayNum} ${monthStr}` : `${dayNum} ${monthStr}`;

    // Weekend boost simulation
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const multiplier = isWeekend ? 1.35 : 0.95 + (Math.sin(i * 0.4) * 0.2);
    
    const dayReach = Math.round(baseReach * multiplier + ((i * 17) % 350));
    const dayImpressions = Math.round(dayReach * 1.55 + ((i * 29) % 420));
    const dayEngagements = Math.round(dayReach * 0.078 + ((i * 11) % 45));

    totalReach += dayReach;
    totalImpressions += dayImpressions;
    totalEngagements += dayEngagements;

    dailyTrends.push({
      date: dateStr,
      label,
      reach: dayReach,
      impressions: dayImpressions,
      engagements: dayEngagements
    });
  }

  const avgEr = Number(((totalEngagements / Math.max(totalReach, 1)) * 100).toFixed(2));

  // Demo Post Insights
  const demoPosts: SocialPostInsight[] = [
    {
      id: "demo-post-1",
      workspaceId: "demo",
      channel: "INSTAGRAM",
      externalPostId: "ig_post_101",
      postUrl: "https://instagram.com",
      postTitle: "3 Rahasia Bangun Kebiasaan Ngonten Tanpa Burnout untuk Bisnis",
      postCaption: "Pernah merasa kehabisan ide di tengah jalan? Simak formula 3 langkah ini agar jadwal konten bisnismu selalu siap 1 bulan penuh!",
      mediaType: "CAROUSEL",
      mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
      publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      viewsCount: 14200,
      reachCount: 11850,
      impressionsCount: 18400,
      likesCount: 842,
      commentsCount: 94,
      sharesCount: 156,
      savesCount: 312,
      engagementRate: 11.84,
      performanceScore: "VIRAL"
    },
    {
      id: "demo-post-2",
      workspaceId: "demo",
      channel: "TIKTOK",
      externalPostId: "tk_post_102",
      postUrl: "https://tiktok.com",
      postTitle: "POV: Ketika AI bikin konten 30 hari dalam 5 menit 🚀",
      postCaption: "Hemat waktu 20 jam seminggu cuma pakai automated publishing workflow! Cobain sekarang.",
      mediaType: "VIDEO",
      mediaUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&auto=format&fit=crop&q=80",
      publishedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      viewsCount: 28900,
      reachCount: 22400,
      impressionsCount: 34100,
      likesCount: 1840,
      commentsCount: 142,
      sharesCount: 420,
      savesCount: 512,
      engagementRate: 13.01,
      performanceScore: "VIRAL"
    },
    {
      id: "demo-post-3",
      workspaceId: "demo",
      channel: "FACEBOOK",
      externalPostId: "fb_post_103",
      postUrl: "https://facebook.com",
      postTitle: "Panduan Lengkap: Cara Menentukan Pilar Konten Bisnis yang Menghasilkan Penjualan",
      postCaption: "Banyak brand rajin posting tapi sepi konversi. Ini 4 pilar wajib yang perlu ada di kalender konten tokomu.",
      mediaType: "IMAGE",
      mediaUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
      publishedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      viewsCount: 7600,
      reachCount: 6200,
      impressionsCount: 9100,
      likesCount: 388,
      commentsCount: 45,
      sharesCount: 62,
      savesCount: 94,
      engagementRate: 9.5,
      performanceScore: "HIGH"
    },
    {
      id: "demo-post-4",
      workspaceId: "demo",
      channel: "INSTAGRAM",
      externalPostId: "ig_post_104",
      postUrl: "https://instagram.com",
      postTitle: "Studi Kasus: Meningkatkan Follower Organik +240% dalam 60 Hari",
      postCaption: "Konsistensi adalah kunci. Ini strategi distribusi multi-channel yang kami gunakan.",
      mediaType: "CAROUSEL",
      mediaUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80",
      publishedAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      viewsCount: 9800,
      reachCount: 8100,
      impressionsCount: 12400,
      likesCount: 512,
      commentsCount: 68,
      sharesCount: 88,
      savesCount: 198,
      engagementRate: 10.69,
      performanceScore: "HIGH"
    },
    {
      id: "demo-post-5",
      workspaceId: "demo",
      channel: "INSTAGRAM",
      externalPostId: "ig_post_105",
      postUrl: "https://instagram.com",
      postTitle: "Behind The Scenes: Alur Kerja Kreatif Tim Kami Menyiapkan 90 Konten",
      postCaption: "Intip dapur pembuatan konten mulai dari riset tren hingga generate visual otomatis.",
      mediaType: "IMAGE",
      mediaUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
      publishedAt: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString(),
      viewsCount: 5400,
      reachCount: 4600,
      impressionsCount: 6800,
      likesCount: 245,
      commentsCount: 31,
      sharesCount: 24,
      savesCount: 65,
      engagementRate: 7.93,
      performanceScore: "NORMAL"
    },
    {
      id: "demo-post-6",
      workspaceId: "demo",
      channel: "TIKTOK",
      externalPostId: "tk_post_106",
      postUrl: "https://tiktok.com",
      postTitle: "Tutorial 60 Detik: Format Caption yang Mengundang Ribuan Komentar",
      postCaption: "Gunakan trik open loop di 3 detik pertama dan CTA di baris terakhir.",
      mediaType: "VIDEO",
      mediaUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
      publishedAt: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString(),
      viewsCount: 18400,
      reachCount: 14900,
      impressionsCount: 21500,
      likesCount: 1120,
      commentsCount: 89,
      sharesCount: 230,
      savesCount: 340,
      engagementRate: 11.94,
      performanceScore: "HIGH"
    },
    {
      id: "demo-post-7",
      workspaceId: "demo",
      channel: "FACEBOOK",
      externalPostId: "fb_post_107",
      postUrl: "https://facebook.com",
      postTitle: "Q&A Mingguan: Menjawab Pertanyaan Seputar Optimasi Konten Sosmed Bisnis",
      postCaption: "Tulis pertanyaanmu di kolom komentar, akan kami bedah langsung di sesi live minggu depan!",
      mediaType: "IMAGE",
      mediaUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&auto=format&fit=crop&q=80",
      publishedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      viewsCount: 4200,
      reachCount: 3500,
      impressionsCount: 5100,
      likesCount: 178,
      commentsCount: 42,
      sharesCount: 15,
      savesCount: 28,
      engagementRate: 7.51,
      performanceScore: "NORMAL"
    }
  ];

  // Filter posts if channel filter specified
  const filteredPosts = channelFilter && channelFilter !== "ALL"
    ? demoPosts.filter((p) => p.channel === channelFilter)
    : demoPosts;

  const summary: AnalyticsSummary = {
    period,
    channel: channelFilter || "ALL",
    totalReach,
    reachGrowth: 18.4,
    totalViews: totalImpressions,
    viewsGrowth: 22.7,
    totalEngagements,
    engagementGrowth: 14.9,
    averageEngagementRate: avgEr,
    totalFollowers: 14850,
    newFollowers: 1120,
    followerGrowth: 8.2,
    connectedChannels: [
      {
        channel: "INSTAGRAM",
        accountName: `@${workspaceName.toLowerCase().replace(/\s+/g, "_")}`,
        isConnected: true,
        followersCount: 8450
      },
      {
        channel: "TIKTOK",
        accountName: `@${workspaceName.toLowerCase().replace(/\s+/g, "")}.official`,
        isConnected: true,
        followersCount: 4800
      },
      {
        channel: "FACEBOOK",
        accountName: `${workspaceName} Page`,
        isConnected: true,
        followersCount: 1600
      }
    ],
    dailyTrends,
    platformDistribution: [
      { channel: "INSTAGRAM", sharePercentage: 54, totalEngagements: Math.round(totalEngagements * 0.54), reach: Math.round(totalReach * 0.52) },
      { channel: "TIKTOK", sharePercentage: 32, totalEngagements: Math.round(totalEngagements * 0.32), reach: Math.round(totalReach * 0.35) },
      { channel: "FACEBOOK", sharePercentage: 14, totalEngagements: Math.round(totalEngagements * 0.14), reach: Math.round(totalReach * 0.13) }
    ],
    formatDistribution: [
      { format: "CAROUSEL", label: "Carousel", count: 12, avgReach: 9975, avgEngagement: 11.2 },
      { format: "VIDEO", label: "Short Video / Reels", count: 8, avgReach: 18650, avgEngagement: 12.4 },
      { format: "IMAGE", label: "Single Image", count: 18, avgReach: 4760, avgEngagement: 8.3 }
    ],
    audienceDemographics: {
      gender: {
        female: 62,
        male: 35,
        other: 3
      },
      ageRanges: [
        { range: "18-24 thn", percentage: 34 },
        { range: "25-34 thn", percentage: 46 },
        { range: "35-44 thn", percentage: 14 },
        { range: "45+ thn", percentage: 6 }
      ],
      topCities: [
        { city: "Jakarta", percentage: 38 },
        { city: "Surabaya", percentage: 22 },
        { city: "Bandung", percentage: 16 },
        { city: "Medan", percentage: 12 },
        { city: "Semarang", percentage: 8 }
      ]
    },
    smartInsights: {
      topPost: demoPosts[1],
      bestPostingTimes: [
        { day: "Selasa", time: "19:00 - 21:00 WIB", reason: "Engagement rate tertinggi (+34% vs rata-rata)" },
        { day: "Kamis", time: "12:00 - 13:30 WIB", reason: "Lonjakan interaksi jam istirahat kerja" },
        { day: "Minggu", time: "09:00 - 11:00 WIB", reason: "Waktu penelusuran santai akhir pekan" }
      ],
      aiRecommendation: `Format Carousel edukasi dan Short Video tentang studi kasus menghasilkan rasio Save & Share tertinggi (+42%). Disarankan menambah 2 slot video pendek mingguan di pilar Edukasi.`
    }
  };

  return { summary, posts: filteredPosts };
}

export async function fetchWorkspaceAnalytics(
  workspaceId: string,
  period: AnalyticsPeriod = "30d",
  channelFilter: string = "ALL"
): Promise<{ summary: AnalyticsSummary; posts: SocialPostInsight[] }> {
  const db = createDatabase(serverEnv().DATABASE_URL);

  return withTenant(db, workspaceId, async (tx) => {
    // 1. Check workspace and connected channels
    const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    const workspaceName = workspace?.name ?? "Workspace";

    const connections = await tx.select().from(socialConnections).where(eq(socialConnections.workspaceId, workspaceId));

    // 2. Fetch real post insights from DB
    const days = getDaysForPeriod(period);
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const conditions = [
      eq(socialPostInsights.workspaceId, workspaceId),
      gte(socialPostInsights.publishedAt, cutoffDate)
    ];

    if (channelFilter && channelFilter !== "ALL") {
      conditions.push(eq(socialPostInsights.channel, channelFilter as any));
    }

    const realPosts = await tx
      .select()
      .from(socialPostInsights)
      .where(and(...conditions))
      .orderBy(desc(socialPostInsights.publishedAt))
      .limit(50);

    // If real data exists in DB, aggregate it!
    if (realPosts.length > 0) {
      const posts: SocialPostInsight[] = realPosts.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        conceptId: r.conceptId,
        channel: r.channel,
        externalPostId: r.externalPostId,
        postUrl: r.postUrl,
        postTitle: r.postTitle,
        postCaption: r.postCaption,
        mediaType: r.mediaType as any,
        mediaUrl: r.mediaUrl,
        publishedAt: r.publishedAt.toISOString(),
        viewsCount: r.viewsCount,
        reachCount: r.reachCount,
        impressionsCount: r.impressionsCount,
        likesCount: r.likesCount,
        commentsCount: r.commentsCount,
        sharesCount: r.sharesCount,
        savesCount: r.savesCount,
        engagementRate: Number((r.engagementRate / 100).toFixed(2)),
        performanceScore: (r.performanceScore as any) || "NORMAL"
      }));

      // Calculate totals
      let totalReach = 0;
      let totalViews = 0;
      let totalEngagements = 0;

      for (const p of posts) {
        totalReach += p.reachCount;
        totalViews += p.impressionsCount;
        totalEngagements += (p.likesCount + p.commentsCount + p.sharesCount + p.savesCount);
      }

      const avgEr = posts.length > 0 ? Number(((totalEngagements / Math.max(totalReach, 1)) * 100).toFixed(2)) : 0;

      // Group daily trends
      const dailyTrendsMap = new Map<string, { reach: number; impressions: number; engagements: number }>();
      for (const p of posts) {
        const dStr = p.publishedAt.split("T")[0]!;
        const current = dailyTrendsMap.get(dStr) || { reach: 0, impressions: 0, engagements: 0 };
        current.reach += p.reachCount;
        current.impressions += p.impressionsCount;
        current.engagements += (p.likesCount + p.commentsCount + p.sharesCount + p.savesCount);
        dailyTrendsMap.set(dStr, current);
      }

      const dailyTrends = Array.from(dailyTrendsMap.entries()).map(([date, metrics]) => {
        const d = new Date(date);
        return {
          date,
          label: `${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "short" })}`,
          reach: metrics.reach,
          impressions: metrics.impressions,
          engagements: metrics.engagements
        };
      });

      const topPost = [...posts].sort((a, b) => b.engagementRate - a.engagementRate)[0];

      const summary: AnalyticsSummary = {
        period,
        channel: channelFilter,
        totalReach,
        reachGrowth: 14.5,
        totalViews,
        viewsGrowth: 18.2,
        totalEngagements,
        engagementGrowth: 12.0,
        averageEngagementRate: avgEr,
        totalFollowers: 12500,
        newFollowers: 850,
        followerGrowth: 6.8,
        connectedChannels: connections.map((c) => ({
          channel: c.channel,
          accountName: c.accountName,
          isConnected: !c.disconnectedAt,
          followersCount: 3500
        })),
        dailyTrends,
        platformDistribution: [
          { channel: "INSTAGRAM", sharePercentage: 60, totalEngagements: Math.round(totalEngagements * 0.6), reach: Math.round(totalReach * 0.6) },
          { channel: "FACEBOOK", sharePercentage: 40, totalEngagements: Math.round(totalEngagements * 0.4), reach: Math.round(totalReach * 0.4) }
        ],
        formatDistribution: [
          { format: "IMAGE", label: "Image", count: posts.filter((p) => p.mediaType === "IMAGE").length, avgReach: 4500, avgEngagement: 8.1 },
          { format: "CAROUSEL", label: "Carousel", count: posts.filter((p) => p.mediaType === "CAROUSEL").length, avgReach: 9200, avgEngagement: 11.5 }
        ],
        audienceDemographics: {
          gender: { female: 58, male: 39, other: 3 },
          ageRanges: [
            { range: "18-24 thn", percentage: 32 },
            { range: "25-34 thn", percentage: 48 },
            { range: "35-44 thn", percentage: 15 },
            { range: "45+ thn", percentage: 5 }
          ],
          topCities: [
            { city: "Jakarta", percentage: 42 },
            { city: "Surabaya", percentage: 24 },
            { city: "Bandung", percentage: 18 }
          ]
        },
        smartInsights: {
          topPost,
          bestPostingTimes: [
            { day: "Selasa", time: "19:00 WIB", reason: "Interaksi tertinggi" },
            { day: "Jumat", time: "13:00 WIB", reason: "Lonjakan reach siang" }
          ],
          aiRecommendation: "Fokus tingkatkan pilar Edukasi dan Carousel yang memiliki durasi interaksi terlama."
        }
      };

      return { summary, posts };
    }

    // If no real DB rows yet, provide realistic workspace-tailored demo analytics
    return generateDemoAnalyticsData(workspaceName, period, channelFilter);
  });
}
