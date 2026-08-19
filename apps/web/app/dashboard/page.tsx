import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Clock3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Globe,
  ImageIcon,
  Layers,
  MoreHorizontal,
  Play,
  Plus,
  Radio,
  Send,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Zap
} from "lucide-react";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import {
  calendarSlots,
  contentCalendars,
  contentConcepts,
  createDatabase,
  socialConnections,
  users,
  withTenant,
  workspaces
} from "@routie/db";
import type { ContentState } from "@routie/domain";
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { CalendarBuilder } from "@/components/calendar-builder";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

const stateConfig: Record<ContentState, { label: string; tone: "blue" | "green" | "amber" | "red" | "purple" | "gray" }> = {
  IDEA_DRAFT: { label: "Draft", tone: "gray" },
  IDEA_REVIEW: { label: "Review Ide", tone: "blue" },
  IDEA_APPROVED: { label: "Ide Disetujui", tone: "green" },
  GENERATING: { label: "Membuat Media", tone: "purple" },
  FINAL_REVIEW: { label: "Review Final", tone: "amber" },
  APPROVED: { label: "Disetujui", tone: "green" },
  SCHEDULED: { label: "Terjadwal", tone: "blue" },
  PUBLISHING: { label: "Menerbitkan", tone: "purple" },
  PUBLISHED: { label: "Terbit", tone: "green" },
  REJECTED: { label: "Ditolak", tone: "red" },
  HELD: { label: "Ditahan", tone: "amber" },
  FAILED: { label: "Gagal", tone: "red" }
};

export default async function DashboardPage() {
  await connection();
  const session = await requireSession();
  const db = createDatabase(serverEnv().DATABASE_URL);
  
  const data = await withTenant(db, session.workspaceId, async (tx) => {
    const [identity, concepts, connections] = await Promise.all([
      tx.select({ workspaceName: workspaces.name, userName: users.name })
        .from(workspaces)
        .innerJoin(users, eq(users.id, session.sub))
        .where(eq(workspaces.id, session.workspaceId))
        .limit(1),
      tx.select({
        id: contentConcepts.id,
        topic: contentConcepts.topic,
        pillar: contentConcepts.contentPillar,
        state: contentConcepts.state,
        kind: contentConcepts.recommendedKind,
        localDate: calendarSlots.localDate,
        localTime: calendarSlots.localTime,
        channels: contentCalendars.channels
      })
        .from(contentConcepts)
        .innerJoin(calendarSlots, eq(calendarSlots.id, contentConcepts.slotId))
        .innerJoin(contentCalendars, eq(contentCalendars.id, calendarSlots.calendarId))
        .where(and(eq(contentConcepts.workspaceId, session.workspaceId), eq(contentCalendars.workspaceId, session.workspaceId)))
        .orderBy(asc(calendarSlots.scheduledFor))
        .limit(93),
      tx.select().from(socialConnections).where(eq(socialConnections.workspaceId, session.workspaceId))
    ]);
    return { identity: identity[0], concepts, connections };
  });

  const waiting = data.concepts.filter((item) => item.state === "IDEA_REVIEW" || item.state === "FINAL_REVIEW").length;
  const ready = data.concepts.filter((item) => item.state === "APPROVED" || item.state === "SCHEDULED").length;
  const published = data.concepts.filter((item) => item.state === "PUBLISHED").length;
  const attention = data.concepts.filter((item) => item.state === "HELD" || item.state === "FAILED").length + 
    data.connections.filter((item) => item.disconnectedAt || (item.tokenExpiresAt && item.tokenExpiresAt <= new Date())).length;
  const approved = data.concepts.filter((item) => ["IDEA_APPROVED", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(item.state)).length;
  const ideaReview = data.concepts.filter((item) => item.state === "IDEA_REVIEW").length;
  const finalReview = data.concepts.filter((item) => item.state === "FINAL_REVIEW").length;
  const connectedChannels = data.connections.filter((item) => !item.disconnectedAt).length;

  const now = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(new Date());

  return (
    <AppShell
      active="Overview"
      identity={{
        workspaceName: data.identity?.workspaceName ?? "Workspace",
        userName: data.identity?.userName ?? session.email,
        role: session.role,
        approvalCount: waiting,
        unreadCount: 0
      }}
    >
      <div className="crm-page-container">
        {/* Page Header */}
        <section className="crm-page-header">
          <div className="crm-header-info">
            <span className="crm-header-date">{now}</span>
            <h1 className="crm-page-title">
              Selamat datang kembali, {data.identity?.userName?.split(" ")[0] ?? "Owner"}
            </h1>
            <p className="crm-page-desc">
              Berikut adalah ringkasan produksi konten, antrean review, dan status jadwal tayang di workspace <strong>{data.identity?.workspaceName ?? "ini"}</strong>.
            </p>
          </div>
          <div className="crm-header-actions">
            <CalendarBuilder />
          </div>
        </section>

        {/* 4-Card CRM Metric Grid */}
        <section className="crm-metrics-grid">
          {/* Card 1: Total Concepts */}
          <div className="crm-metric-card">
            <div className="crm-metric-top">
              <span className="crm-metric-label">TOTAL KONSEP BULAN INI</span>
              <span className="crm-metric-tag blue">Aktif</span>
            </div>
            <div className="crm-metric-body">
              <span className="crm-metric-number">
                {String(data.concepts.length).padStart(2, "0")}
              </span>
              <div className="crm-metric-icon-wrap blue">
                <Layers size={18} />
              </div>
            </div>
            <div className="crm-metric-footer">
              <span className="crm-trend positive">
                <TrendingUp size={12} /> Target 100%
              </span>
              <span className="crm-metric-subtext">1-3 konsep per hari</span>
            </div>
          </div>

          {/* Card 2: Pending Approval */}
          <div className="crm-metric-card">
            <div className="crm-metric-top">
              <span className="crm-metric-label">MENUNGGU REVIEW</span>
              <span className="crm-metric-tag amber">{waiting > 0 ? "Perlu Tindakan" : "Semua Beres"}</span>
            </div>
            <div className="crm-metric-body">
              <span className="crm-metric-number">
                {String(waiting).padStart(2, "0")}
              </span>
              <div className="crm-metric-icon-wrap amber">
                <Clock3 size={18} />
              </div>
            </div>
            <div className="crm-metric-footer">
              <span className="crm-metric-highlight amber">
                {finalReview} Final · {ideaReview} Ide
              </span>
              <span className="crm-metric-subtext">sebelum biaya render</span>
            </div>
          </div>

          {/* Card 3: Ready to Publish */}
          <div className="crm-metric-card">
            <div className="crm-metric-top">
              <span className="crm-metric-label">SIAP DIPUBLIKASI</span>
              <span className="crm-metric-tag green">Terjadwal</span>
            </div>
            <div className="crm-metric-body">
              <span className="crm-metric-number">
                {String(ready).padStart(2, "0")}
              </span>
              <div className="crm-metric-icon-wrap green">
                <Send size={18} />
              </div>
            </div>
            <div className="crm-metric-footer">
              <span className="crm-metric-highlight green">
                {published} sudah terbit
              </span>
              <span className="crm-metric-subtext">otomatis sesuai slot</span>
            </div>
          </div>

          {/* Card 4: Channel Health */}
          <div className="crm-metric-card">
            <div className="crm-metric-top">
              <span className="crm-metric-label">CHANNEL TERHUBUNG</span>
              <span className={`crm-metric-tag ${attention > 0 ? "red" : "green"}`}>
                {attention > 0 ? `${attention} Perlu Cek` : "Semua Normal"}
              </span>
            </div>
            <div className="crm-metric-body">
              <span className="crm-metric-number">
                {String(connectedChannels).padStart(2, "0")}
              </span>
              <div className={`crm-metric-icon-wrap ${attention > 0 ? "red" : "purple"}`}>
                <Globe size={18} />
              </div>
            </div>
            <div className="crm-metric-footer">
              <span className="crm-metric-subtext">
                {data.connections.length} total integrasi sosial
              </span>
            </div>
          </div>
        </section>

        {/* Content Pipeline CRM Table Section */}
        <section className="crm-card crm-pipeline-section" id="content">
          <div className="crm-card-header">
            <div className="crm-card-title-group">
              <h2 className="crm-card-title">Pipeline Konten Terjadwal</h2>
              <p className="crm-card-subtitle">
                Daftar konsep konten terdekat hasil generate AI yang siap ditinjau dan diterbitkan.
              </p>
            </div>
            <div className="crm-card-actions">
              <Link href="/approvals" className="crm-btn crm-btn-secondary">
                <FileCheck2 size={14} />
                <span>Buka Antrean Review</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* CRM Data Table */}
          <div className="crm-table-container">
            {data.concepts.length === 0 ? (
              <div className="crm-empty-state">
                <div className="crm-empty-icon">
                  <Sparkles size={24} />
                </div>
                <h3>Belum ada konten di kalender</h3>
                <p>Mulai dengan membuat kalender bulanan menggunakan AI untuk mengisi slot otomatis.</p>
                <div style={{ marginTop: "16px" }}>
                  <CalendarBuilder />
                </div>
              </div>
            ) : (
              <table className="crm-table">
                <thead>
                  <tr>
                    <th style={{ width: "120px" }}>JADWAL</th>
                    <th>TOPIK & KONSEP</th>
                    <th style={{ width: "140px" }}>PILLAR</th>
                    <th style={{ width: "160px" }}>CHANNELS</th>
                    <th style={{ width: "120px" }}>FORMAT</th>
                    <th style={{ width: "130px" }}>STATUS</th>
                    <th style={{ width: "80px", textAlign: "right" }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.concepts.slice(0, 8).map((concept) => {
                    const status = stateConfig[concept.state] ?? { label: concept.state, tone: "gray" };
                    const date = new Date(`${concept.localDate}T00:00:00Z`);
                    const formattedDate = new Intl.DateTimeFormat("id-ID", {
                      day: "2-digit",
                      month: "short",
                      timeZone: "UTC"
                    }).format(date);

                    return (
                      <tr key={concept.id} className="crm-table-row">
                        {/* Jadwal */}
                        <td>
                          <div className="crm-date-cell">
                            <span className="crm-date-badge">{formattedDate}</span>
                            <span className="crm-time-text">{concept.localTime || "09:00"}</span>
                          </div>
                        </td>

                        {/* Topik & Konsep */}
                        <td>
                          <div className="crm-topic-cell">
                            <div className="crm-topic-title">
                              {concept.topic || "AI sedang menyiapkan draf ide..."}
                            </div>
                          </div>
                        </td>

                        {/* Content Pillar */}
                        <td>
                          <span className="crm-pillar-badge">
                            {concept.pillar || "Umum"}
                          </span>
                        </td>

                        {/* Channels */}
                        <td>
                          <div className="crm-channel-tags">
                            {concept.channels.slice(0, 3).map((ch) => (
                              <span key={ch} className="crm-channel-tag" title={ch}>
                                {ch.slice(0, 2).toLowerCase()}
                              </span>
                            ))}
                            {concept.channels.length > 3 && (
                              <span className="crm-channel-tag overflow">
                                +{concept.channels.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Format */}
                        <td>
                          <div className="crm-format-badge">
                            {concept.kind === "SHORT_VIDEO" ? (
                              <>
                                <Play size={12} className="crm-format-icon video" />
                                <span>Video</span>
                              </>
                            ) : (
                              <>
                                <ImageIcon size={12} className="crm-format-icon image" />
                                <span>Image</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`crm-status-pill ${status.tone}`}>
                            <span className="crm-status-dot" />
                            {status.label}
                          </span>
                        </td>

                        {/* Action */}
                        <td style={{ textAlign: "right" }}>
                          <Link
                            href="/approvals"
                            className="crm-row-action-btn"
                            title="Tinjau Konsep"
                          >
                            <Eye size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {data.concepts.length > 8 && (
            <div className="crm-table-footer">
              <span className="crm-table-count">
                Menampilkan 8 dari {data.concepts.length} total konsep
              </span>
              <Link href="/approvals" className="crm-btn crm-btn-ghost">
                Lihat Semua Antrean <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </section>

        {/* Bottom 2-Column Section: Velocity & Channel Health */}
        <section className="crm-bottom-grid">
          {/* Approval Progress & Velocity */}
          <div className="crm-card crm-approval-widget">
            <div className="crm-card-header">
              <div className="crm-card-title-group">
                <h2 className="crm-card-title">Kemajuan Approval</h2>
                <p className="crm-card-subtitle">Status verifikasi sebelum jadwal rilis</p>
              </div>
              <span className="crm-badge blue">{waiting} pending</span>
            </div>

            <div className="crm-approval-widget-body">
              <div className="crm-progress-bar-container">
                <div className="crm-progress-bar-header">
                  <span>Tingkat Kesiapan Konten</span>
                  <b>{data.concepts.length ? Math.round((approved / data.concepts.length) * 100) : 0}%</b>
                </div>
                <div className="crm-progress-track">
                  <div
                    className="crm-progress-fill"
                    style={{
                      width: `${data.concepts.length ? Math.round((approved / data.concepts.length) * 100) : 0}%`
                    }}
                  />
                </div>
              </div>

              <div className="crm-stats-trio">
                <div className="crm-stat-box">
                  <span className="crm-stat-val text-green">{approved}</span>
                  <span className="crm-stat-lbl">Disetujui</span>
                </div>
                <div className="crm-stat-box">
                  <span className="crm-stat-val text-blue">{ideaReview}</span>
                  <span className="crm-stat-lbl">Review Ide</span>
                </div>
                <div className="crm-stat-box">
                  <span className="crm-stat-val text-amber">{finalReview}</span>
                  <span className="crm-stat-lbl">Review Final</span>
                </div>
              </div>

              <div className="crm-widget-action">
                <Link href="/approvals" className="crm-btn crm-btn-primary full">
                  <CheckCircle2 size={15} />
                  <span>Buka Approval Center</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Social Channels Health */}
          <div className="crm-card crm-channels-widget">
            <div className="crm-card-header">
              <div className="crm-card-title-group">
                <h2 className="crm-card-title">Status Integrasi Channel</h2>
                <p className="crm-card-subtitle">Kesiapan jalur auto-publish sosial media</p>
              </div>
              <Link href="/settings#connections" className="crm-btn crm-btn-ghost">
                Kelola
              </Link>
            </div>

            <div className="crm-channels-list">
              {data.connections.length === 0 ? (
                <div className="crm-empty-state-mini">
                  <p>Belum ada akun sosial media yang terhubung.</p>
                  <Link href="/settings#connections" className="crm-btn crm-btn-secondary">
                    Hubungkan Sekarang
                  </Link>
                </div>
              ) : (
                data.connections.slice(0, 4).map((conn) => {
                  const isHealthy = !conn.disconnectedAt && (!conn.tokenExpiresAt || conn.tokenExpiresAt > new Date());
                  return (
                    <div key={conn.id} className="crm-channel-row">
                      <div className="crm-channel-icon-box">
                        {conn.channel[0]}
                      </div>
                      <div className="crm-channel-meta">
                        <span className="crm-channel-name">{conn.channel}</span>
                        <span className="crm-channel-handle">{conn.accountName || "Official Account"}</span>
                      </div>
                      <div className="crm-channel-status">
                        <span className={`crm-status-pill ${isHealthy ? "green" : "amber"}`}>
                          <span className="crm-status-dot" />
                          {isHealthy ? "Connected" : "Reconnect"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
