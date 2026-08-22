import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Eye,
  FileCheck2,
  Globe2,
  ImageIcon,
  Layers3,
  Play,
  Send,
  Sparkles,
  TrendingUp
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
import { requirePageSession } from "@/lib/page-auth";
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

const readyStates: ContentState[] = ["APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED"];

export default async function DashboardPage() {
  await connection();
  const session = await requirePageSession();
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

  const total = data.concepts.length;
  const waiting = data.concepts.filter((item) => item.state === "IDEA_REVIEW" || item.state === "FINAL_REVIEW").length;
  const ready = data.concepts.filter((item) => item.state === "APPROVED" || item.state === "SCHEDULED").length;
  const published = data.concepts.filter((item) => item.state === "PUBLISHED").length;
  const attention = data.concepts.filter((item) => item.state === "HELD" || item.state === "FAILED").length
    + data.connections.filter((item) => item.disconnectedAt || (item.tokenExpiresAt && item.tokenExpiresAt <= new Date())).length;
  const approved = data.concepts.filter((item) => ["IDEA_APPROVED", ...readyStates].includes(item.state)).length;
  const ideaReview = data.concepts.filter((item) => item.state === "IDEA_REVIEW").length;
  const finalReview = data.concepts.filter((item) => item.state === "FINAL_REVIEW").length;
  const connectedChannels = data.connections.filter((item) => !item.disconnectedAt).length;
  const readiness = total ? Math.round((approved / total) * 100) : 0;

  const now = new Date();
  const fullDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(now);
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta"
  }).format(now);
  const today = new Date(`${todayIso}T00:00:00Z`);
  const activityDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const concepts = data.concepts.filter((item) => item.localDate === iso);
    return {
      iso,
      weekday: new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(date),
      date: new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone: "UTC" }).format(date),
      total: concepts.length,
      ready: concepts.filter((item) => readyStates.includes(item.state)).length
    };
  });
  const maxActivity = Math.max(1, ...activityDays.map((item) => item.total));
  const firstName = data.identity?.userName?.split(" ")[0] ?? "Owner";
  const workspaceName = data.identity?.workspaceName ?? "workspace ini";

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
      <div className="crm-page-container crm-dashboard-page">
        <section className="crm-dash-hero">
          <div className="crm-dash-hero-copy">
            <div className="crm-dash-kicker"><span className="crm-dash-live-dot" />{fullDate}</div>
            <h1>Selamat datang, {firstName}</h1>
            <p>Pantau produksi, approval, dan jadwal publikasi <strong>{workspaceName}</strong> dari satu tempat.</p>
          </div>
          <div className="crm-dash-hero-action">
            <span className="crm-dash-action-note">Rencanakan konten berikutnya</span>
            <CalendarBuilder />
          </div>
        </section>

        <section className="crm-dash-kpi-grid" aria-label="Ringkasan performa konten">
          <article className="crm-dash-kpi-card tone-indigo">
            <div className="crm-dash-kpi-head"><span className="crm-dash-kpi-icon"><Layers3 size={19} /></span><span className="crm-dash-kpi-chip"><TrendingUp size={12} /> Bulan ini</span></div>
            <div className="crm-dash-kpi-value">{total}</div>
            <div className="crm-dash-kpi-label">Total konsep</div>
            <p>Ide yang masuk ke pipeline konten.</p>
          </article>
          <article className="crm-dash-kpi-card tone-amber">
            <div className="crm-dash-kpi-head"><span className="crm-dash-kpi-icon"><Clock3 size={19} /></span><span className="crm-dash-kpi-chip">{waiting > 0 ? "Perlu tindakan" : "Semua beres"}</span></div>
            <div className="crm-dash-kpi-value">{waiting}</div>
            <div className="crm-dash-kpi-label">Menunggu review</div>
            <p>{ideaReview} ide · {finalReview} hasil final.</p>
          </article>
          <article className="crm-dash-kpi-card tone-green">
            <div className="crm-dash-kpi-head"><span className="crm-dash-kpi-icon"><Send size={19} /></span><span className="crm-dash-kpi-chip"><ArrowUpRight size={12} /> Siap jalan</span></div>
            <div className="crm-dash-kpi-value">{ready}</div>
            <div className="crm-dash-kpi-label">Siap dipublikasi</div>
            <p>Konten approved dan terjadwal.</p>
          </article>
          <article className="crm-dash-kpi-card tone-blue">
            <div className="crm-dash-kpi-head"><span className="crm-dash-kpi-icon"><CheckCircle2 size={19} /></span><span className="crm-dash-kpi-chip">Auto-publish</span></div>
            <div className="crm-dash-kpi-value">{published}</div>
            <div className="crm-dash-kpi-label">Sudah terbit</div>
            <p>Tayang melalui channel terhubung.</p>
          </article>
        </section>

        <section className="crm-dash-overview-grid">
          <article className="crm-dash-panel crm-dash-activity-card">
            <header className="crm-dash-panel-header">
              <div><span className="crm-dash-eyebrow">7 HARI KE DEPAN</span><h2>Aktivitas konten</h2><p>Volume konsep yang dijadwalkan setiap hari.</p></div>
              <Link href="/calendar" className="crm-dash-text-link">Buka kalender <ChevronRight size={15} /></Link>
            </header>
            <div className="crm-dash-chart-summary">
              <div><strong>{activityDays.reduce((sum, item) => sum + item.total, 0)}</strong><span>total konten</span></div>
              <div className="crm-dash-chart-legend"><span><i className="planned" /> Terencana</span><span><i className="ready" /> Siap tayang</span></div>
            </div>
            <div className="crm-dash-chart-bars">
              {activityDays.map((item, index) => {
                const barHeight = item.total ? Math.max(20, Math.round((item.total / maxActivity) * 100)) : 7;
                const readyHeight = item.total ? Math.round((item.ready / item.total) * 100) : 0;
                return (
                  <div className="crm-dash-chart-column" key={item.iso}>
                    <div className="crm-dash-chart-value">{item.total || "–"}</div>
                    <div className="crm-dash-chart-track">
                      <div className={`crm-dash-chart-bar ${index === 0 ? "today" : ""}`} style={{ height: `${barHeight}%` }}>
                        {readyHeight > 0 && <span style={{ height: `${readyHeight}%` }} />}
                      </div>
                    </div>
                    <div className="crm-dash-chart-label"><span>{item.weekday}</span><b>{item.date}</b></div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="crm-dash-panel crm-dash-readiness-card">
            <header className="crm-dash-panel-header compact">
              <div><span className="crm-dash-eyebrow">WORKFLOW HEALTH</span><h2>Kesiapan publikasi</h2></div>
              <span className={`crm-dash-health-pill ${attention > 0 ? "warning" : "healthy"}`}>{attention > 0 ? `${attention} isu` : "Sehat"}</span>
            </header>
            <div className="crm-dash-readiness-main">
              <div className="crm-dash-progress-ring" style={{ background: `conic-gradient(var(--crm-primary) 0 ${readiness}%, #EEF0F7 ${readiness}% 100%)` }} aria-label={`${readiness}% konten siap`}>
                <div><strong>{readiness}%</strong><span>siap</span></div>
              </div>
              <div className="crm-dash-readiness-copy"><strong>{approved} dari {total}</strong><span>konten sudah melewati approval</span></div>
            </div>
            <div className="crm-dash-flow-list">
              <div><span className="dot blue" /><span>Review ide</span><strong>{ideaReview}</strong></div>
              <div><span className="dot amber" /><span>Review final</span><strong>{finalReview}</strong></div>
              <div><span className="dot green" /><span>Approved & tayang</span><strong>{approved}</strong></div>
            </div>
            <Link href="/approvals" className="crm-btn crm-btn-primary crm-dash-full-button"><FileCheck2 size={15} /> Buka Approval Center</Link>
          </article>
        </section>

        <section className="crm-dash-panel crm-dash-pipeline" id="content">
          <header className="crm-dash-panel-header crm-dash-table-heading">
            <div><span className="crm-dash-eyebrow">CONTENT PIPELINE</span><h2>Jadwal terdekat</h2><p>Konsep prioritas yang akan masuk ke proses review dan publikasi.</p></div>
            <Link href="/approvals" className="crm-btn crm-btn-secondary crm-dash-review-button">Lihat semua <ArrowRight size={14} /></Link>
          </header>
          <div className="crm-table-container">
            {data.concepts.length === 0 ? (
              <div className="crm-empty-state crm-dash-empty-state">
                <div className="crm-empty-icon"><Sparkles size={24} /></div><h3>Belum ada konten di kalender</h3><p>Buat kalender bulanan dan biarkan Routie menyiapkan pipeline pertamamu.</p>
                <div className="crm-dash-empty-action"><CalendarBuilder /></div>
              </div>
            ) : (
              <table className="crm-table crm-dash-table">
                <thead><tr><th>JADWAL</th><th>TOPIK & KONSEP</th><th>PILLAR</th><th>CHANNEL</th><th>FORMAT</th><th>STATUS</th><th><span className="crm-sr-only">Aksi</span></th></tr></thead>
                <tbody>
                  {data.concepts.slice(0, 6).map((concept) => {
                    const status = stateConfig[concept.state] ?? { label: concept.state, tone: "gray" };
                    const date = new Date(`${concept.localDate}T00:00:00Z`);
                    const formattedDate = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
                    return (
                      <tr key={concept.id} className="crm-table-row">
                        <td data-label="Jadwal"><div className="crm-date-cell"><span className="crm-date-badge">{formattedDate}</span><span className="crm-time-text">{concept.localTime || "09:00"} WIB</span></div></td>
                        <td data-label="Topik"><div className="crm-topic-cell"><div className="crm-topic-title">{concept.topic || "AI sedang menyiapkan draf ide..."}</div></div></td>
                        <td data-label="Pillar"><span className="crm-pillar-badge">{concept.pillar || "Umum"}</span></td>
                        <td data-label="Channel"><div className="crm-channel-tags">
                          {concept.channels.slice(0, 3).map((channel) => <span key={channel} className="crm-channel-tag" title={channel}>{channel.slice(0, 2).toUpperCase()}</span>)}
                          {concept.channels.length > 3 && <span className="crm-channel-tag overflow">+{concept.channels.length - 3}</span>}
                        </div></td>
                        <td data-label="Format"><div className="crm-format-badge">{concept.kind === "SHORT_VIDEO" ? <><Play size={12} /><span>Video</span></> : <><ImageIcon size={12} /><span>Image</span></>}</div></td>
                        <td data-label="Status"><span className={`crm-status-pill ${status.tone}`}><span className="crm-status-dot" />{status.label}</span></td>
                        <td data-label="Aksi"><Link href="/approvals" className="crm-row-action-btn" title="Tinjau konsep" aria-label={`Tinjau ${concept.topic || "konsep"}`}><Eye size={14} /></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {data.concepts.length > 6 && <footer className="crm-table-footer"><span className="crm-table-count">Menampilkan 6 dari {data.concepts.length} konsep</span><Link href="/approvals" className="crm-dash-text-link">Lihat seluruh pipeline <ArrowRight size={14} /></Link></footer>}
        </section>

        <section className="crm-dash-bottom-grid">
          <article className="crm-dash-panel crm-dash-focus-card">
            <header className="crm-dash-panel-header compact"><div><span className="crm-dash-eyebrow">NEXT ACTIONS</span><h2>Fokus hari ini</h2></div><CalendarClock size={19} /></header>
            <div className="crm-dash-focus-list">
              <Link href="/approvals"><span className="crm-dash-focus-icon amber"><Clock3 size={16} /></span><span><strong>Review yang menunggu</strong><small>Selesaikan sebelum proses render</small></span><b>{waiting}</b></Link>
              <Link href="/calendar"><span className="crm-dash-focus-icon green"><Send size={16} /></span><span><strong>Konten siap tayang</strong><small>Approved atau sudah terjadwal</small></span><b>{ready}</b></Link>
              <Link href="/settings/connectors"><span className={`crm-dash-focus-icon ${attention > 0 ? "red" : "blue"}`}><CircleAlert size={16} /></span><span><strong>Kesehatan workspace</strong><small>{attention > 0 ? "Ada item yang perlu diperiksa" : "Tidak ada kendala aktif"}</small></span><b>{attention}</b></Link>
            </div>
          </article>

          <article className="crm-dash-panel crm-dash-channel-card">
            <header className="crm-dash-panel-header compact"><div><span className="crm-dash-eyebrow">DISTRIBUTION</span><h2>Channel terhubung</h2></div><span className="crm-dash-channel-count"><Globe2 size={14} /> {connectedChannels}</span></header>
            <div className="crm-dash-channel-list">
              {data.connections.length === 0 ? (
                <div className="crm-dash-channel-empty"><Globe2 size={20} /><span>Belum ada channel yang terhubung.</span><Link href="/settings/connectors">Hubungkan channel</Link></div>
              ) : data.connections.slice(0, 4).map((channel) => {
                const healthy = !channel.disconnectedAt && (!channel.tokenExpiresAt || channel.tokenExpiresAt > new Date());
                return (
                  <div className="crm-dash-channel-row" key={channel.id}>
                    <span className="crm-dash-channel-avatar">{channel.channel.slice(0, 2)}</span>
                    <span><strong>{channel.channel}</strong><small>{channel.accountName || "Official account"}</small></span>
                    <span className={`crm-dash-connection-state ${healthy ? "connected" : "warning"}`}><i /> {healthy ? "Connected" : "Reconnect"}</span>
                  </div>
                );
              })}
            </div>
            <Link href="/settings/connectors" className="crm-dash-manage-link">Kelola integrasi <ArrowRight size={14} /></Link>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
