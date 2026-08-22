"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  ImageIcon,
  ImagePlus,
  Info,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  X,
  XCircle
} from "lucide-react";
import type { ContentState, SocialChannel, WorkspaceRole } from "@routie/domain";

export interface ApprovalConcept {
  id: string;
  state: ContentState;
  version: number;
  topic: string;
  hook: string;
  outline: string;
  initialCaption: string;
  contentPillar: string;
  recommendedKind: "TEXT" | "IMAGE" | "CAROUSEL" | "SHORT_VIDEO" | "STORY";
  heldReason: string | null;
  localDate: string;
  localTime: string;
  timezone: string;
  channels: SocialChannel[];
  sources: Array<{ id: string; url: string; title: string }>;
}

type Filter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";
type Draft = Pick<ApprovalConcept, "topic" | "hook" | "outline" | "initialCaption" | "contentPillar" | "recommendedKind">;

const approvedStates = new Set<ContentState>([
  "IDEA_APPROVED",
  "GENERATING",
  "FINAL_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED"
]);
const pendingStates = new Set<ContentState>(["IDEA_REVIEW", "FINAL_REVIEW"]);

const stateLabels: Partial<Record<ContentState, { label: string; tone: "blue" | "green" | "amber" | "red" | "purple" | "gray" }>> = {
  IDEA_DRAFT: { label: "Draft Ide", tone: "gray" },
  IDEA_REVIEW: { label: "Review Ide", tone: "blue" },
  IDEA_APPROVED: { label: "Ide Disetujui", tone: "green" },
  REJECTED: { label: "Ditolak", tone: "red" },
  GENERATING: { label: "Membuat Media", tone: "purple" },
  FINAL_REVIEW: { label: "Review Final", tone: "amber" },
  APPROVED: { label: "Disetujui", tone: "green" },
  SCHEDULED: { label: "Terjadwal", tone: "blue" },
  PUBLISHED: { label: "Terbit", tone: "green" },
  FAILED: { label: "Render Gagal", tone: "red" },
  HELD: { label: "Ditahan", tone: "amber" }
};

function toDraft(concept: ApprovalConcept): Draft {
  return {
    topic: concept.topic,
    hook: concept.hook,
    outline: concept.outline,
    initialCaption: concept.initialCaption,
    contentPillar: concept.contentPillar,
    recommendedKind: concept.recommendedKind
  };
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

export function ApprovalCenter({
  initialConcepts,
  role
}: {
  initialConcepts: ApprovalConcept[];
  role: WorkspaceRole;
}) {
  const router = useRouter();
  const [concepts, setConcepts] = useState(initialConcepts);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    initialConcepts.find((concept) => concept.state === "IDEA_REVIEW")?.id ?? initialConcepts[0]?.id ?? ""
  );
  const [draft, setDraft] = useState<Draft | null>(
    initialConcepts[0] ? toDraft(initialConcepts.find((c) => c.id === selectedId) ?? initialConcepts[0]) : null
  );
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState<"save" | "approve" | "reject" | "render" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selected = concepts.find((concept) => concept.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setDraft(toDraft(selected));
    setEditing(false);
    setRejecting(false);
    setRejectionReason("");
    setMessage(null);
  }, [selectedId]);

  const counts = useMemo(() => ({
    pending: concepts.filter((c) => pendingStates.has(c.state)).length,
    approved: concepts.filter((c) => approvedStates.has(c.state)).length,
    rejected: concepts.filter((c) => c.state === "REJECTED").length,
    all: concepts.length
  }), [concepts]);

  const visible = useMemo(() => {
    return concepts.filter((concept) => {
      const matchesFilter =
        filter === "ALL" ||
        (filter === "PENDING" && pendingStates.has(concept.state)) ||
        (filter === "APPROVED" && approvedStates.has(concept.state)) ||
        (filter === "REJECTED" && concept.state === "REJECTED");
      const normalizedQuery = query.trim().toLowerCase();
      return (
        matchesFilter &&
        (!normalizedQuery ||
          concept.topic.toLowerCase().includes(normalizedQuery) ||
          concept.hook.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [concepts, filter, query]);

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function moveToNext(currentId: string, updated: ApprovalConcept[]) {
    const currentIndex = updated.findIndex((concept) => concept.id === currentId);
    const next = [...updated.slice(currentIndex + 1), ...updated.slice(0, currentIndex)].find(
      (concept) => concept.state === "IDEA_REVIEW" || concept.state === "FINAL_REVIEW"
    );
    if (next) setSelectedId(next.id);
  }

  async function save() {
    if (!selected || !draft) return;
    setLoading("save");
    setMessage(null);
    try {
      const response = await fetch(`/api/concepts/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, expectedVersion: selected.version })
      });
      const payload = (await response.json()) as {
        concept?: ApprovalConcept;
        message?: string;
        issues?: Array<{ message?: string }>;
      };
      if (!response.ok || !payload.concept)
        throw new Error(payload.message ?? payload.issues?.[0]?.message ?? "Perubahan gagal disimpan");
      setConcepts((current) =>
        current.map((concept) =>
          concept.id === selected.id
            ? { ...concept, ...payload.concept, sources: concept.sources, channels: concept.channels }
            : concept
        )
      );
      setEditing(false);
      setMessage({ type: "success", text: "Perubahan ide tersimpan." });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Perubahan gagal disimpan" });
    } finally {
      setLoading(null);
    }
  }

  async function decide(to: "IDEA_APPROVED" | "REJECTED") {
    if (!selected) return;
    setLoading(to === "IDEA_APPROVED" ? "approve" : "reject");
    setMessage(null);
    try {
      const response = await fetch(`/api/concepts/${selected.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          expectedVersion: selected.version,
          ...(to === "REJECTED" ? { reason: rejectionReason } : {})
        })
      });
      const payload = (await response.json()) as {
        state?: ContentState;
        mediaQueued?: boolean;
        message?: string;
        issues?: Array<{ message?: string }>;
      };
      if (!response.ok || !payload.state)
        throw new Error(payload.message ?? payload.issues?.[0]?.message ?? "Keputusan gagal disimpan");
      const nextState = payload.mediaQueued ? "GENERATING" : payload.state;
      const updated = concepts.map((concept) =>
        concept.id === selected.id ? { ...concept, state: nextState!, version: concept.version + 1 } : concept
      );
      setConcepts(updated);
      setRejecting(false);
      setMessage({
        type: "success",
        text:
          to === "IDEA_APPROVED"
            ? payload.mediaQueued
              ? "Ide disetujui. AI sedang membuat master visual."
              : "Ide disetujui dan siap masuk tahap render."
            : "Ide ditolak dan dicatat di audit log."
      });
      router.refresh();
      window.setTimeout(() => moveToNext(selected.id, updated), 450);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Keputusan gagal disimpan" });
    } finally {
      setLoading(null);
    }
  }

  async function renderMedia() {
    if (!selected) return;
    setLoading("render");
    setMessage(null);
    try {
      const response = await fetch(`/api/concepts/${selected.id}/render`, { method: "POST" });
      const payload = (await response.json()) as {
        queued?: boolean;
        message?: string;
        issues?: Array<{ message?: string }>;
      };
      if (!response.ok || !payload.queued)
        throw new Error(payload.message ?? payload.issues?.[0]?.message ?? "Media gagal masuk antrean");
      setConcepts((current) =>
        current.map((concept) => (concept.id === selected.id ? { ...concept, state: "GENERATING" } : concept))
      );
      setMessage({ type: "success", text: "Gambar master sedang dibuat. Biasanya selesai dalam 1–2 menit." });
      window.setTimeout(() => router.refresh(), 8_000);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Media gagal masuk antrean" });
    } finally {
      setLoading(null);
    }
  }

  const canApprove = role === "OWNER" || role === "APPROVER";
  const canEdit =
    role !== "APPROVER" &&
    selected &&
    ["IDEA_DRAFT", "IDEA_REVIEW", "IDEA_APPROVED", "REJECTED"].includes(selected.state);
  const failedReason = selected?.heldReason?.includes("billing_hard_limit_reached")
    ? "Kredit API OpenAI belum tersedia atau batas billing sudah tercapai. Isi kredit di platform OpenAI, lalu klik Coba lagi."
    : selected?.heldReason;

  const currentStatusConfig = selected ? stateLabels[selected.state] ?? { label: selected.state, tone: "gray" } : null;

  return (
    <div className="crm-approval-suite">
      {/* Top Interactive Summary Cards */}
      <section className="crm-approval-filters-grid">
        <button
          type="button"
          className={`crm-filter-card ${filter === "PENDING" ? "active" : ""}`}
          onClick={() => setFilter("PENDING")}
        >
          <div className="crm-filter-icon amber">
            <Clock size={18} />
          </div>
          <div className="crm-filter-info">
            <span className="crm-filter-label">Menunggu keputusan</span>
            <span className="crm-filter-val">{String(counts.pending).padStart(2, "0")}</span>
            <span className="crm-filter-caption">Butuh ditinjau hari ini</span>
          </div>
          <span className="crm-filter-indicator">Aktif</span>
        </button>

        <button
          type="button"
          className={`crm-filter-card ${filter === "APPROVED" ? "active" : ""}`}
          onClick={() => setFilter("APPROVED")}
        >
          <div className="crm-filter-icon green">
            <CheckCircle2 size={18} />
          </div>
          <div className="crm-filter-info">
            <span className="crm-filter-label">Telah disetujui</span>
            <span className="crm-filter-val">{String(counts.approved).padStart(2, "0")}</span>
            <span className="crm-filter-caption">Siap lanjut ke proses berikutnya</span>
          </div>
          <span className="crm-filter-indicator">Selesai</span>
        </button>

        <button
          type="button"
          className={`crm-filter-card ${filter === "REJECTED" ? "active" : ""}`}
          onClick={() => setFilter("REJECTED")}
        >
          <div className="crm-filter-icon red">
            <XCircle size={18} />
          </div>
          <div className="crm-filter-info">
            <span className="crm-filter-label">Ditolak / perlu revisi</span>
            <span className="crm-filter-val">{String(counts.rejected).padStart(2, "0")}</span>
            <span className="crm-filter-caption">Perlu perhatian dari tim</span>
          </div>
          <span className="crm-filter-indicator">Perlu aksi</span>
        </button>
      </section>

      {/* Master-Detail Split Workspace */}
      <section className="crm-card crm-approval-workspace">
        {/* Left Column: Master Queue List */}
        <aside className="crm-approval-master">
          <div className="crm-approval-master-head">
            <div>
              <h3>Antrian konten</h3>
              <p>Pilih item untuk melihat detail</p>
            </div>
            <span>{visible.length} item</span>
          </div>
          <div className="crm-master-toolbar">
            <div className="crm-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Cari topik atau hook..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="crm-clear-btn" onClick={() => setQuery("")}>
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              type="button"
              className={`crm-btn crm-btn-sm ${filter === "ALL" ? "crm-btn-primary" : "crm-btn-secondary"}`}
              onClick={() => setFilter("ALL")}
            >
              Semua ({counts.all})
            </button>
          </div>

          <div className="crm-master-list">
            {visible.length === 0 ? (
              <div className="crm-empty-state-mini">
                <p>Tidak ada konten pada filter ini.</p>
              </div>
            ) : (
              visible.map((concept) => {
                const isSelected = concept.id === selectedId;
                const status = stateLabels[concept.state] ?? { label: concept.state, tone: "gray" };

                return (
                  <button
                    key={concept.id}
                    type="button"
                    className={`crm-queue-item ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedId(concept.id)}
                  >
                    <div className="crm-queue-date-col">
                      <span className="crm-queue-day">{concept.localDate.slice(-2)}</span>
                      <span className="crm-queue-month">{dateLabel(concept.localDate).split(" ")[0]}</span>
                    </div>

                    <div className="crm-queue-content-col">
                      <div className="crm-queue-tags">
                        <span className="crm-pillar-micro">{concept.contentPillar || "Umum"}</span>
                        <span className="crm-format-micro">{concept.recommendedKind}</span>
                      </div>
                      <h4 className="crm-queue-title">{concept.topic}</h4>
                      <p className="crm-queue-hook">{concept.hook}</p>
                    </div>

                    <div className="crm-queue-status-col">
                      <span className={`crm-status-pill small ${status.tone}`}>
                        <span className="crm-status-dot" />
                        {status.label}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Detail Workstation Pane */}
        <div className="crm-approval-detail">
          {!selected || !draft ? (
            <div className="crm-empty-state">
              <Info size={28} />
              <h3>Pilih konsep untuk meninjau detail</h3>
              <p>Pilih salah satu item di daftar sebelah kiri untuk melihat brief, naskah, dan status approval.</p>
            </div>
          ) : (
            <div className="crm-detail-inner">
              {/* Detail Header & Action Toolbar */}
              <div className="crm-detail-top-bar">
                <div className="crm-detail-title-group">
                  <div className="crm-detail-meta-row">
                    {currentStatusConfig && (
                      <span className={`crm-status-pill ${currentStatusConfig.tone}`}>
                        <span className="crm-status-dot" />
                        {currentStatusConfig.label}
                      </span>
                    )}
                    <span className="crm-detail-schedule">
                      <CalendarDays size={13} />
                      {dateLabel(selected.localDate)}, {selected.localTime} ({selected.timezone})
                    </span>
                  </div>
                  <h2 className="crm-detail-heading">{selected.topic}</h2>
                </div>

                <div className="crm-detail-actions-group">
                  {canEdit && !editing && (
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary"
                      onClick={() => setEditing(true)}
                    >
                      <Edit3 size={14} />
                      <span>Edit Draf</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Target Social Channels Banner */}
              <div className="crm-detail-channels-bar">
                <span className="crm-channels-label">Target Channels:</span>
                <div className="crm-channels-tags-row">
                  {selected.channels.map((channel) => (
                    <span key={channel} className="crm-channel-pill">
                      {channel}
                    </span>
                  ))}
                </div>
              </div>

              {/* Structured Form Fields */}
              <div className="crm-detail-sections">
                {/* Section A: Concept & Pillar Info */}
                <div className="crm-detail-card">
                  <h3 className="crm-card-sec-title">
                    <Layers size={14} />
                    <span>Brief & Klasifikasi Konsep</span>
                  </h3>

                  <div className="crm-form-group">
                    <label className="crm-label">Topik Utama</label>
                    <input
                      type="text"
                      className="crm-input"
                      value={draft.topic}
                      disabled={!editing}
                      onChange={(e) => updateDraft("topic", e.target.value)}
                    />
                  </div>

                  <div className="crm-form-grid-2">
                    <div className="crm-form-group">
                      <label className="crm-label">Content Pillar</label>
                      <input
                        type="text"
                        className="crm-input"
                        value={draft.contentPillar}
                        disabled={!editing}
                        onChange={(e) => updateDraft("contentPillar", e.target.value)}
                      />
                    </div>

                    <div className="crm-form-group">
                      <label className="crm-label">Format Rekomendasi</label>
                      <select
                        className="crm-select"
                        value={draft.recommendedKind}
                        disabled={!editing}
                        onChange={(e) => updateDraft("recommendedKind", e.target.value as any)}
                      >
                        <option value="IMAGE">IMAGE (Gambar Master)</option>
                        <option value="CAROUSEL">CAROUSEL (Multi Slide)</option>
                        <option value="SHORT_VIDEO">SHORT_VIDEO (Reels/TikTok/Shorts)</option>
                        <option value="TEXT">TEXT (Status / Tweet)</option>
                        <option value="STORY">STORY (24 Jam)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section B: Copywriting & Content */}
                <div className="crm-detail-card">
                  <h3 className="crm-card-sec-title">
                    <FileText size={14} />
                    <span>Copywriting & Struktur Konten</span>
                  </h3>

                  <div className="crm-form-group">
                    <label className="crm-label">Hook Pembuka (3 Detik Pertama)</label>
                    <textarea
                      rows={3}
                      className="crm-textarea"
                      value={draft.hook}
                      disabled={!editing}
                      onChange={(e) => updateDraft("hook", e.target.value)}
                      placeholder="Kalimat pemikat atensi..."
                    />
                  </div>

                  <div className="crm-form-group">
                    <label className="crm-label">Outline & Poin Pembahasan</label>
                    <textarea
                      rows={4}
                      className="crm-textarea"
                      value={draft.outline}
                      disabled={!editing}
                      onChange={(e) => updateDraft("outline", e.target.value)}
                      placeholder="Poin 1, poin 2, solusi..."
                    />
                  </div>

                  <div className="crm-form-group">
                    <label className="crm-label">Caption Lengkap & Call-to-Action</label>
                    <textarea
                      rows={6}
                      className="crm-textarea"
                      value={draft.initialCaption}
                      disabled={!editing}
                      onChange={(e) => updateDraft("initialCaption", e.target.value)}
                      placeholder="Tuliskan naskah caption lengkap..."
                    />
                  </div>
                </div>

                {/* Section C: Research Sources */}
                {selected.sources.length > 0 && (
                  <div className="crm-detail-card">
                    <h3 className="crm-card-sec-title">
                      <Globe size={14} />
                      <span>Sumber Riset & Referensi Web</span>
                    </h3>
                    <div className="crm-sources-list">
                      {selected.sources.map((source) => (
                        <a
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="crm-source-chip"
                        >
                          <span>{source.title}</span>
                          <ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Feedback Toast */}
              {message && (
                <div className={`crm-alert-toast ${message.type}`}>
                  {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Edit Mode Actions */}
              {editing && (
                <div className="crm-detail-bottom-actions">
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary"
                    onClick={() => {
                      setDraft(toDraft(selected));
                      setEditing(false);
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>Batal</span>
                  </button>
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary"
                    onClick={save}
                    disabled={loading !== null}
                  >
                    {loading === "save" ? <Loader2 className="spin" size={14} /> : <Check size={14} />}
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              )}

              {/* Decision Workflow Actions */}
              {!editing && selected.state === "IDEA_REVIEW" && canApprove && (
                <div className="crm-decision-footer">
                  {rejecting ? (
                    <div className="crm-rejection-box">
                      <label className="crm-label">Alasan Penolakan</label>
                      <textarea
                        autoFocus
                        rows={2}
                        className="crm-textarea"
                        placeholder="Tuliskan catatan revisi untuk tim atau AI..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                      />
                      <div className="crm-rejection-btns">
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary"
                          onClick={() => setRejecting(false)}
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          className="crm-btn crm-btn-danger"
                          onClick={() => decide("REJECTED")}
                          disabled={loading !== null || rejectionReason.trim().length < 3}
                        >
                          {loading === "reject" ? <Loader2 className="spin" size={14} /> : <XCircle size={14} />}
                          <span>Konfirmasi Tolak</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="crm-decision-bar">
                      <button
                        type="button"
                        className="crm-btn crm-btn-danger-outline"
                        onClick={() => setRejecting(true)}
                      >
                        <XCircle size={14} />
                        <span>Tolak Ide</span>
                      </button>
                      <button
                        type="button"
                        className="crm-btn crm-btn-primary"
                        onClick={() => decide("IDEA_APPROVED")}
                        disabled={loading !== null}
                      >
                        {loading === "approve" ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                        <span>Setujui Ide Konten</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Post-Approval Render Status Cards */}
              {selected.state === "IDEA_APPROVED" && (
                <div className="crm-notice-box success">
                  <div className="crm-notice-icon">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="crm-notice-content">
                    <b>Ide Sudah Disetujui</b>
                    <p>Siap membuat satu gambar master menggunakan provider IMAGE yang telah dikonfigurasi.</p>
                  </div>
                  {role !== "APPROVER" && (
                    <button
                      type="button"
                      className="crm-btn crm-btn-primary"
                      onClick={renderMedia}
                      disabled={loading !== null}
                    >
                      {loading === "render" ? <Loader2 className="spin" size={14} /> : <ImagePlus size={14} />}
                      <span>Buat Media Sekarang</span>
                    </button>
                  )}
                </div>
              )}

              {selected.state === "GENERATING" && (
                <div className="crm-notice-box purple">
                  <div className="crm-notice-icon">
                    <Loader2 className="spin" size={18} />
                  </div>
                  <div className="crm-notice-content">
                    <b>AI Sedang Memproses Media Visual</b>
                    <p>Worker sedang me-render aset grafis. Hasil akan otomatis masuk ke tahap review final.</p>
                  </div>
                </div>
              )}

              {selected.state === "FAILED" && (
                <div className="crm-notice-box red">
                  <div className="crm-notice-icon">
                    <AlertCircle size={18} />
                  </div>
                  <div className="crm-notice-content">
                    <b>Render Belum Berhasil</b>
                    <p>{failedReason || "Provider IMAGE menolak request. Periksa credential atau kuota API."}</p>
                  </div>
                  {role !== "APPROVER" && (
                    <button
                      type="button"
                      className="crm-btn crm-btn-danger"
                      onClick={renderMedia}
                      disabled={loading !== null}
                    >
                      {loading === "render" ? <Loader2 className="spin" size={14} /> : <RotateCcw size={14} />}
                      <span>Coba Render Ulang</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
