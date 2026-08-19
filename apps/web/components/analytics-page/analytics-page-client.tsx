"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  Heart,
  Layers,
  PlugZap,
  RefreshCw,
  Share2,
  Sparkles,
  TrendingUp,
  Users
} from "lucide-react";
import Link from "next/link";
import type { AnalyticsPeriod, AnalyticsSummary, SocialPostInsight } from "@routie/domain";
import { AnalyticsKpiCard } from "./analytics-kpi-card";
import { AnalyticsCharts } from "./analytics-charts";
import { AnalyticsSmartInsights } from "./analytics-smart-insights";
import { AnalyticsPostsTable } from "./analytics-posts-table";
import { AnalyticsDemographics } from "./analytics-demographics";

interface AnalyticsPageClientProps {
  initialSummary: AnalyticsSummary;
  initialPosts: SocialPostInsight[];
}

export function AnalyticsPageClient({ initialSummary, initialPosts }: AnalyticsPageClientProps) {
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialSummary.period || "30d");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [summary, setSummary] = useState<AnalyticsSummary>(initialSummary);
  const [posts, setPosts] = useState<SocialPostInsight[]>(initialPosts);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Fetch updated data on period or channel change
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/analytics/summary?period=${period}&channel=${selectedChannel}`);
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
          setPosts(data.posts);
        }
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setIsLoading(false);
      }
    }

    // Skip first load if matching initial props
    if (period !== initialSummary.period || selectedChannel !== "ALL") {
      loadData();
    }
  }, [period, selectedChannel]);

  // Handle manual sync
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: selectedChannel })
      });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(data.message || "Data analitik berhasil disinkronkan!");
        // Refresh summary
        const refRes = await fetch(`/api/analytics/summary?period=${period}&channel=${selectedChannel}`);
        const refData = await refRes.json();
        if (refData.success) {
          setSummary(refData.summary);
          setPosts(refData.posts);
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
      setSyncMessage("Gagal sinkronisasi data.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    setIsExporting(true);
    const downloadUrl = `/api/analytics/export?period=${period}&channel=${selectedChannel}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `routie-analytics-${period}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setIsExporting(false), 1500);
  };

  return (
    <div className="crm-page-container crm-analytics-page">
      {/* 1. Header Area with Controls */}
      <section className="crm-page-header crm-analytics-header-section">
        <div className="crm-header-info">
          <span className="crm-header-date">STATISTIK & PERFORMA KONTEN</span>
          <h1 className="crm-page-title">Statistik & Analisis Audiens</h1>
          <p className="crm-page-desc">
            Pantau pertumbuhan follower, jangkauan tayangan, dan rasio interaksi konten sosial media Anda secara terpadu.
          </p>
        </div>

        <div className="crm-analytics-header-actions">
          {/* Period Selector */}
          <div className="crm-period-select-wrap">
            <Calendar size={14} className="text-muted" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
              className="crm-select-compact"
            >
              <option value="7d">7 Hari Terakhir</option>
              <option value="30d">30 Hari Terakhir</option>
              <option value="90d">90 Hari Terakhir</option>
              <option value="1y">1 Tahun Terakhir</option>
            </select>
          </div>

          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="crm-btn crm-btn-secondary"
            title="Sinkronkan data metrik terbaru dari platform"
          >
            <RefreshCw size={14} className={isSyncing ? "crm-spin" : ""} />
            <span>{isSyncing ? "Sinkronisasi..." : "Sinkronkan Data"}</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="crm-btn crm-btn-primary"
          >
            <Download size={14} />
            <span>{isExporting ? "Menyiapkan CSV..." : "Export Laporan"}</span>
          </button>
        </div>
      </section>

      {/* Sync Notification Toast */}
      {syncMessage && (
        <div className="crm-toast-banner">
          <CheckCircle2 size={16} />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* 2. Platform Selector Tabs */}
      <section className="crm-platform-tabs-row">
        {[
          { id: "ALL", label: "Semua Platform", icon: Layers, isConnected: true },
          { id: "INSTAGRAM", label: "Instagram", icon: null, initial: "In", isConnected: true },
          { id: "TIKTOK", label: "TikTok", icon: null, initial: "Tk", isConnected: true },
          { id: "FACEBOOK", label: "Facebook", icon: null, initial: "Fb", isConnected: true }
        ].map((tab) => {
          const isActive = selectedChannel === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`crm-platform-tab-item ${isActive ? "active" : ""}`}
              onClick={() => setSelectedChannel(tab.id)}
            >
              {tab.icon ? (
                <tab.icon size={15} />
              ) : (
                <span className="crm-channel-pill-avatar">{tab.initial}</span>
              )}
              <span className="crm-platform-tab-label">{tab.label}</span>
              <span className="crm-channel-status-dot connected" title="Terhubung" />
            </button>
          );
        })}
      </section>

      {/* 3. KPI Overview Cards (5 Columns) */}
      <section className="crm-kpi-row">
        <AnalyticsKpiCard
          title="Total Jangkauan (Reach)"
          value={summary.totalReach}
          delta={summary.reachGrowth}
          subtitle="Akun unik yang melihat konten"
          icon={<Users size={18} />}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
        />
        <AnalyticsKpiCard
          title="Total Impresi / Tayangan"
          value={summary.totalViews}
          delta={summary.viewsGrowth}
          subtitle="Frekuensi total tayang di feed"
          icon={<Eye size={18} />}
          iconBg="#F5F3FF"
          iconColor="#7C3AED"
        />
        <AnalyticsKpiCard
          title="Total Interaksi (Engagements)"
          value={summary.totalEngagements}
          delta={summary.engagementGrowth}
          subtitle="Likes, Comments, Shares, Saves"
          icon={<Heart size={18} />}
          iconBg="#FEF2F2"
          iconColor="#DC2626"
        />
        <AnalyticsKpiCard
          title="Rata-rata Engagement Rate"
          value={`${summary.averageEngagementRate}%`}
          subtitle="Tingkat interaksi vs reach"
          icon={<Activity size={18} />}
          iconBg="#ECFDF5"
          iconColor="#059669"
          badge="High Impact"
        />
        <AnalyticsKpiCard
          title="Total Followers"
          value={summary.totalFollowers}
          delta={summary.followerGrowth}
          subtitle={`+${summary.newFollowers.toLocaleString("id-ID")} pengikut baru`}
          icon={<TrendingUp size={18} />}
          iconBg="#FFFBEB"
          iconColor="#D97706"
        />
      </section>

      {/* 4. Interactive Trend Charts & Platform Breakdown */}
      <section>
        <AnalyticsCharts summary={summary} />
      </section>

      {/* 5. Smart AI Insights & Top Performer */}
      <section>
        <AnalyticsSmartInsights summary={summary} topPost={posts[0]} />
      </section>

      {/* 6. Audience Demographics */}
      <section>
        <AnalyticsDemographics demographics={summary.audienceDemographics} />
      </section>

      {/* 7. Detailed Posts Performance Table */}
      <section>
        <AnalyticsPostsTable
          posts={posts}
          onExportCsv={handleExportCsv}
          isExporting={isExporting}
        />
      </section>
    </div>
  );
}
