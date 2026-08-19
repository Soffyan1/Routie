"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  Hash,
  Image as ImageIcon,
  Layers,
  Loader2,
  Paintbrush,
  PlaySquare,
  Send,
  Sparkles,
  Tag,
  Trash2,
  User,
  X
} from "lucide-react";
import type { CalendarConceptItem } from "@/app/api/calendar/route";
import { EditContentModal } from "./edit-content-modal";
import { RevisionModal } from "./revision-modal";

interface ContentDetailModalProps {
  concept: CalendarConceptItem;
  onClose: () => void;
  onRefresh: () => void;
}

export function ContentDetailModal({ concept, onClose, onRefresh }: ContentDetailModalProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);

  // Helper for Status Badge & Label
  function getStatusMeta(state: string) {
    switch (state) {
      case "APPROVED":
      case "SCHEDULED":
        return { label: "Ready to Publish", color: "green", dot: "green", desc: "Konten telah disetujui dan siap diterbitkan sesuai jadwal." };
      case "PUBLISHED":
        return { label: "Published", color: "indigo", dot: "indigo", desc: "Konten telah berhasil dipublikasikan ke media sosial." };
      case "FINAL_REVIEW":
        return { label: "Perlu Approval Konten (Visual Siap)", color: "orange", dot: "orange", desc: "Visual konten telah selesai di-generate. Perlu persetujuan akhir sebelum dipublikasikan." };
      case "IDEA_REVIEW":
        return { label: "Perlu Review Ide (Draf Teks)", color: "amber", dot: "amber", desc: "Ide konten baru dari AI, silakan cek topik & caption sebelum dibuatkan visualnya." };
      case "IDEA_APPROVED":
        return { label: "Ide Disetujui (Siap Render)", color: "purple", dot: "purple", desc: "Ide disetujui. Siap diproses pembuatan visual AI." };
      case "GENERATING":
        return { label: "Sedang Generate Media...", color: "purple", dot: "purple", desc: "AI worker sedang membuat gambar / aset media." };
      case "REJECTED":
        return { label: "Ditolak", color: "red", dot: "red", desc: "Konten ditolak atau dibatalkan." };
      case "HELD":
      case "FAILED":
        return { label: "Perlu Perhatian / Direvisi", color: "red", dot: "red", desc: concept.heldReason || "Perlu revisi sebelum diproses." };
      case "IDEA_DRAFT":
      default:
        return { label: "Draft", color: "gray", dot: "gray", desc: "Draf konten masih dalam pengerjaan." };
    }
  }

  const statusMeta = getStatusMeta(concept.state);

  // Transition state handler
  async function handleTransition(toState: string, reason?: string) {
    setLoadingAction(toState);
    setError(null);
    try {
      const res = await fetch(`/api/concepts/${concept.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toState,
          reason: reason || undefined,
          expectedVersion: concept.version
        })
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok) {
        throw new Error(data.message || "Gagal mengubah status konten.");
      }
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses keputusan.");
    } finally {
      setLoadingAction(null);
    }
  }

  // Trigger Render Media handler
  async function handleRenderMedia() {
    setLoadingAction("render");
    setError(null);
    try {
      const res = await fetch(`/api/concepts/${concept.id}/render`, {
        method: "POST"
      });
      const data = (await res.json()) as { queued?: boolean; message?: string };
      if (!res.ok) {
        throw new Error(data.message || "Gagal memproses render media.");
      }
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memulai render.");
    } finally {
      setLoadingAction(null);
    }
  }

  // Delete concept handler
  async function handleDelete() {
    setLoadingAction("delete");
    setError(null);
    try {
      const res = await fetch(`/api/concepts/${concept.id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        throw new Error("Gagal menghapus konten.");
      }
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRegenerateIdea() {
    setLoadingAction("regenerate-idea");
    setError(null);
    try {
      const res = await fetch(`/api/concepts/${concept.id}/regenerate-idea`, {
        method: "POST"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal membuat ulang ide");
      }
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat membuat ulang ide.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <div className="crm-modal-backdrop" role="presentation" onMouseDown={onClose}>
        <div
          className="crm-modal-container crm-content-detail-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="crm-modal-header crm-detail-header">
            <div className="crm-modal-title-wrap">
              <div className="crm-detail-eyebrow-row">
                <span className={`crm-status-pill ${statusMeta.color}`}>
                  <span className={`crm-status-dot ${statusMeta.dot}`} />
                  <span>{statusMeta.label}</span>
                </span>
                <span className="crm-detail-time-tag">
                  <Clock size={12} />
                  <span>{concept.localDate} • {concept.localTime} WIB</span>
                </span>
              </div>
              <h2 className="crm-modal-title" style={{ fontSize: "18px", marginTop: "4px" }}>
                {concept.topic}
              </h2>
            </div>
            <button type="button" className="crm-modal-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </header>

          {/* Body */}
          <div className="crm-modal-form crm-detail-grid-layout">
            {/* Left: Media Preview */}
            <div className="crm-detail-media-column">
              <div className="crm-media-preview-box">
                {concept.mediaAsset?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={concept.mediaAsset.url}
                    alt={concept.topic}
                    className="crm-preview-image"
                  />
                ) : (
                  <div className="crm-preview-placeholder">
                    <div className="crm-preview-icon-wrap">
                      {concept.state === "GENERATING" ? (
                        <Loader2 className="spin" size={32} />
                      ) : (
                        <ImageIcon size={32} />
                      )}
                    </div>
                    <b>
                      {concept.state === "GENERATING"
                        ? "Sedang Membuat Visual AI..."
                        : concept.mediaAsset
                        ? "Memuat Gambar..."
                        : "Visual Belum Dibuat"}
                    </b>
                    <p>
                      {concept.state === "GENERATING"
                        ? "Proses AI memerlukan waktu sekitar 15-30 detik."
                        : "Visual dapat dibuat dengan AI setelah ide konten disetujui."}
                    </p>
                  </div>
                )}
              </div>

              {/* Status explanation alert */}
              <div className={`crm-detail-status-banner ${statusMeta.color}`}>
                <p>{statusMeta.desc}</p>
              </div>
            </div>

            {/* Right: Content Metadata & Details */}
            <div className="crm-detail-info-column">
              {/* Hook */}
              {concept.hook && (
                <div className="crm-detail-block">
                  <span className="crm-detail-label">Hook / Pembuka</span>
                  <div className="crm-detail-hook-box">
                    &ldquo;{concept.hook}&rdquo;
                  </div>
                </div>
              )}

              {/* Caption */}
              <div className="crm-detail-block">
                <span className="crm-detail-label">Caption Lengkap</span>
                <div className="crm-detail-caption-box">
                  {concept.initialCaption || "Belum ada caption."}
                </div>
              </div>

              {/* Hashtags */}
              {concept.hashtags && concept.hashtags.length > 0 && (
                <div className="crm-detail-block">
                  <span className="crm-detail-label">Hashtags</span>
                  <div className="crm-hashtags-cloud">
                    {concept.hashtags.map((tag, idx) => (
                      <span key={idx} className="crm-hashtag-badge">
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Properties Grid */}
              <div className="crm-detail-props-grid">
                <div className="crm-prop-item">
                  <span className="crm-prop-label">Platform Tujuan</span>
                  <div className="crm-platform-tags">
                    {concept.channels.map((ch) => (
                      <span key={ch} className="crm-platform-tag">
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="crm-prop-item">
                  <span className="crm-prop-label">Pilar Konten</span>
                  <span className="crm-prop-val">{concept.contentPillar || "Umum"}</span>
                </div>

                <div className="crm-prop-item">
                  <span className="crm-prop-label">Format Konten</span>
                  <span className="crm-prop-val">{concept.recommendedKind}</span>
                </div>

                <div className="crm-prop-item">
                  <span className="crm-prop-label">Metode Pembuatan</span>
                  <span className="crm-prop-val">
                    {concept.creationMode === "MANUAL"
                      ? "✍️ Manual Upload"
                      : concept.creationMode === "SEMI_AI"
                      ? "⚡ Semi AI (Prompt Sendiri)"
                      : "🤖 Full Otomatis AI"}
                  </span>
                </div>

                <div className="crm-prop-item">
                  <span className="crm-prop-label">Dibuat Oleh</span>
                  <span className="crm-prop-val">{concept.createdBy?.name || "Sistem Routie"}</span>
                </div>

                <div className="crm-prop-item">
                  <span className="crm-prop-label">Terakhir Diperbarui</span>
                  <span className="crm-prop-val">
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    }).format(new Date(concept.updatedAt))}
                  </span>
                </div>
              </div>

              {error && (
                <div className="crm-alert-toast error" style={{ marginTop: "12px" }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <footer className="crm-modal-footer crm-detail-footer">
            <div className="crm-detail-footer-left">
              <button
                type="button"
                className="crm-btn crm-btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loadingAction !== null}
              >
                <Trash2 size={14} />
                <span>Hapus</span>
              </button>
            </div>

            <div className="crm-detail-footer-right">
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => setShowEditModal(true)}
                disabled={loadingAction !== null}
              >
                <Edit3 size={14} />
                <span>Edit Teks</span>
              </button>

              {/* Action 0: If in IDEA_DRAFT or HELD/FAILED without topic -> Allow Generate / Coba Lagi Ide AI */}
              {["IDEA_DRAFT", "HELD", "FAILED"].includes(concept.state) && (
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={handleRegenerateIdea}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === "regenerate-idea" ? (
                    <Loader2 className="spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>Generate Ulang Ide AI</span>
                </button>
              )}

              {/* Action 1: If in FINAL_REVIEW or HELD -> Allow Revision */}
              {["FINAL_REVIEW", "HELD", "FAILED"].includes(concept.state) && (
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  onClick={() => setShowRevisionModal(true)}
                  disabled={loadingAction !== null}
                  style={{ color: "#D97706", borderColor: "#FDE68A" }}
                >
                  <Paintbrush size={14} />
                  <span>Revisi Visual AI</span>
                </button>
              )}

              {/* Action 2: If IDEA_APPROVED -> Allow generate image */}
              {concept.state === "IDEA_APPROVED" && (
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={handleRenderMedia}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === "render" ? (
                    <Loader2 className="spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>Generate Gambar AI</span>
                </button>
              )}

              {/* Action 3: If IDEA_REVIEW -> Allow Approve Idea */}
              {concept.state === "IDEA_REVIEW" && (
                <>
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary"
                    onClick={() => handleTransition("REJECTED", "Ide ditolak")}
                    disabled={loadingAction !== null}
                  >
                    Tolak Ide
                  </button>
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary"
                    onClick={() => handleTransition("IDEA_APPROVED")}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === "IDEA_APPROVED" ? (
                      <Loader2 className="spin" size={14} />
                    ) : (
                      <Check size={14} />
                    )}
                    <span>Setujui Ide</span>
                  </button>
                </>
              )}

              {/* Action 4: If FINAL_REVIEW -> Approve & Ready to publish */}
              {concept.state === "FINAL_REVIEW" && (
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  style={{ background: "#059669" }}
                  onClick={() => handleTransition("APPROVED")}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === "APPROVED" ? (
                    <Loader2 className="spin" size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>Setujui & Siap Terbit</span>
                </button>
              )}

              {/* Action 5: If APPROVED -> Move back to Draft/Hold */}
              {["APPROVED", "SCHEDULED"].includes(concept.state) && (
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  onClick={() => handleTransition("HELD", "Diturunkan kembali ke draf")}
                  disabled={loadingAction !== null}
                >
                  Kembalikan ke Draf
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="crm-modal-backdrop" role="presentation" onClick={() => setShowDeleteConfirm(false)}>
          <div className="crm-modal-container" role="dialog" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <header className="crm-modal-header">
              <div className="crm-modal-icon-wrap" style={{ background: "#FEE2E2", color: "#DC2626" }}>
                <AlertTriangle size={20} />
              </div>
              <div className="crm-modal-title-wrap">
                <h3 className="crm-modal-title">Hapus Konten Ini?</h3>
                <p className="crm-modal-desc">
                  Slot konten dan seluruh visual yang telah dibuat akan dihapus secara permanen dari kalender.
                </p>
              </div>
            </header>
            <footer className="crm-modal-footer">
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loadingAction === "delete"}
              >
                Batal
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-danger"
                onClick={handleDelete}
                disabled={loadingAction === "delete"}
              >
                {loadingAction === "delete" ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                <span>{loadingAction === "delete" ? "Menghapus..." : "Ya, Hapus"}</span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Edit Content Modal */}
      {showEditModal && (
        <EditContentModal
          concept={concept}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            onRefresh();
            onClose();
          }}
        />
      )}

      {/* Revision Modal */}
      {showRevisionModal && (
        <RevisionModal
          concept={concept}
          onClose={() => setShowRevisionModal(false)}
          onSuccess={() => {
            onRefresh();
            onClose();
          }}
        />
      )}
    </>
  );
}
