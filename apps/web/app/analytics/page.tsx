import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { fetchWorkspaceAnalytics } from "@/lib/analytics";
import { AnalyticsPageClient } from "@/components/analytics-page/analytics-page-client";

export default async function AnalyticsPage() {
  await connection();
  const session = await requireSession();

  // Load initial 30 days analytics data
  const { summary, posts } = await fetchWorkspaceAnalytics(session.workspaceId, "30d", "ALL");

  return (
    <AppShell active="Statistik">
      <AnalyticsPageClient initialSummary={summary} initialPosts={posts} />
    </AppShell>
  );
}
