"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clipboard,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Paintbrush,
  Sparkles,
  Trash2,
  Upload,
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
  const [showMediaDetail, setShowMediaDetail] = useState(false);
  const [isDownloadingMedia, setIsDownloadingMedia] = useState(false);
  const [isUploadingVisual, setIsUploadingVisual] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const visualInputRef = useRef<HTMLInputElement>(null);
  const isIdeaGenerationPending = concept.state === "IDEA_DRAFT" && concept.topic === "Menyusun ide konten...";
  const displayTopic =
    ["HELD", "FAILED"].includes(concept.state) && concept.topic === "Menyusun ide konten..."
      ? "Ide belum berhasil dibuat"
      : concept.topic;
  const hasCompletedIdea =
    concept.topic !== "Menyusun ide konten..." &&
    concept.topic !== "Ide belum berhasil dibuat" &&
    Boolean(concept.hook || concept.initialCaption);
  const canRegenerateIdea =
    (["HELD", "FAILED"].includes(concept.state) && !hasCompletedIdea) ||
    (concept.state === "IDEA_DRAFT" && !isIdeaGenerationPending);
  const canRetryMedia =
    ["HELD", "FAILED"].includes(concept.state) && hasCompletedIdea && !concept.mediaAsset;
  const hasActiveMedia = Boolean(concept.mediaAsset?.url && !concept.mediaAsset.archivedAt);
  const isVideo = Boolean(
    concept.mediaAsset &&
      (concept.mediaAsset.kind === "VIDEO" || concept.mediaAsset.mimeType.startsWith("video/"))
  );

  // Helper for Status Badge & Label
  function getStatusMeta(state: string) {
    switch (state) {
      case "APPROVED":
      case "SCHEDULED":
        return { label: "Dijadwalkan", color: "green", dot: "green", desc: "Routie akan menerbitkan konten ini sesuai waktu yang dijadwalkan." };
      case "PUBLISHING":
        return { label: "Sedang Diterbitkan", color: "purple", dot: "purple", desc: "Routie sedang mengirim konten ke akun sosial media Anda." };
      case "PUBLISHED":
        return { label: "Sudah Terbit", color: "indigo", dot: "indigo", desc: "Konten telah berhasil dipublikasikan ke media sosial." };
      case "FINAL_REVIEW":
      case "IDEA_REVIEW":
        return { label: "Menunggu Persetujuan", color: "amber", dot: "amber", desc: "Periksa konten ini, lalu setujui jika sudah sesuai dengan brand Anda." };
      case "IDEA_APPROVED":
        return { label: "Sedang Disiapkan", color: "purple", dot: "purple", desc: "Routie sedang menyiapkan visual dan versi konten untuk akun tujuan." };
      case "GENERATING":
        return { label: "Sedang Disiapkan", color: "purple", dot: "purple", desc: "AI sedang membuat visual dan aset media konten." };
      case "REJECTED":
        return { label: "Tidak Dilanjutkan", color: "red", dot: "red", desc: "Konten ini tidak akan diterbitkan." };
      case "HELD":
      case "FAILED":
        return { label: "Perlu Tindakan", color: "red", dot: "red", desc: concept.heldReason || "Routie memerlukan tindakan sebelum dapat melanjutkan konten ini." };
      case "IDEA_DRAFT":
        if (isIdeaGenerationPending) {
          return { label: "Sedang Disiapkan", color: "purple", dot: "purple", desc: "Routie sedang menyusun ide konten." };
        }
        return { label: "Draft", color: "gray", dot: "gray", desc: "Draf konten belum dikirim ke AI." };
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
        const data = (await res.json()) as { error?: string; message?: string };
        throw new Error(data.message || data.error || "Gagal membuat ulang ide");
      }
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat membuat ulang ide.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDownloadMedia() {
    if (!concept.mediaAsset || !hasActiveMedia) return;
    setIsDownloadingMedia(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${concept.mediaAsset.id}/download`, {
        method: "GET",
        cache: "no-store"
      });
      const data = (await response.json()) as { downloadUrl?: string; filename?: string; message?: string };
      if (!response.ok || !data.downloadUrl) {
        throw new Error(data.message || "Media belum dapat diunduh.");
      }

      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = data.filename || "routie-media";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Gagal mengunduh media.");
    } finally {
      setIsDownloadingMedia(false);
    }
  }

  async function handleVisualUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Hasil visual harus berupa PNG, JPG, atau WebP.");
    setIsUploadingVisual(true); setError(null);
    try {
      const urlResponse = await fetch("/api/assets/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }) });
      const urlData = await urlResponse.json() as { objectKey?: string; uploadUrl?: string; message?: string };
      if (!urlResponse.ok || !urlData.objectKey || !urlData.uploadUrl) throw new Error(urlData.message || "Gagal menyiapkan upload.");
      const putResponse = await fetch(urlData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putResponse.ok) throw new Error("Gagal mengunggah hasil visual.");
      const completeResponse = await fetch("/api/assets/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objectKey: urlData.objectKey, kind: "IMAGE", contentType: file.type, sizeBytes: file.size, checksum: `sha256-ai-result-${Date.now()}-${file.size}`, metadata: { filename: file.name, usage: "AI_RESULT" } }) });
      const completeData = await completeResponse.json() as { asset?: { id: string }; message?: string };
      if (!completeResponse.ok || !completeData.asset?.id) throw new Error(completeData.message || "Gagal menyimpan hasil visual.");
      const attachResponse = await fetch(`/api/concepts/${concept.id}/upload-visual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: completeData.asset.id }) });
      const attachData = await attachResponse.json() as { success?: boolean; message?: string };
      if (!attachResponse.ok || !attachData.success) throw new Error(attachData.message || "Gagal memasukkan visual ke Calendar.");
      onRefresh(); onClose();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Gagal mengunggah hasil visual."); }
    finally { setIsUploadingVisual(false); event.target.value = ""; }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(concept.visualPrompt);
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 1600);
  }

  return (
    <>
      <div
        className="crm-modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          className="crm-modal-container crm-content-detail-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
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
              <h2 className="crm-modal-title">
                {displayTopic}
              </h2>
            </div>
            <button type="button" className="crm-modal-close-btn" onClick={onClose} aria-label="Tutup detail konten">
              <X size={18} />
            </button>
          </header>

          <div className="crm-modal-form crm-detail-grid-layout">
            <div className="crm-detail-media-column">
              <div className="crm-detail-section-heading">
                <div>
                  <span className="crm-detail-kicker">Preview media</span>
                  <strong>{isVideo ? "Video konten" : "Visual konten"}</strong>
                </div>
                {hasActiveMedia && <span className="crm-media-type-chip">{isVideo ? "Video" : "Gambar"}</span>}
              </div>

              {hasActiveMedia ? (
                <button
                  type="button"
                  className="crm-media-preview-box crm-media-preview-button"
                  onClick={() => setShowMediaDetail(true)}
                  aria-label={`Lihat detail ${isVideo ? "video" : "gambar"}`}
                >
                  {isVideo ? (
                    <video
                      src={concept.mediaAsset!.url!}
                      className="crm-preview-image"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={concept.mediaAsset!.url!}
                      alt={concept.topic}
                      className="crm-preview-image"
                    />
                  )}
                  <span className="crm-media-preview-overlay">
                    <span className="crm-media-preview-zoom">
                      <Maximize2 size={16} />
                      Lihat detail
                    </span>
                  </span>
                </button>
              ) : (
                <div className="crm-media-preview-box">
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
                        : concept.mediaAsset?.archivedAt
                        ? "Media Sudah Dibersihkan"
                        : concept.mediaAsset
                        ? "Media Belum Tersedia"
                        : "Visual Belum Dibuat"}
                    </b>
                    <p>
                      {concept.state === "GENERATING"
                        ? "Routie sedang menyiapkan visual untuk konten ini."
                        : concept.mediaAsset?.archivedAt
                        ? "File gambar atau video dihapus otomatis 30 hari setelah terbit. Caption, riwayat, analitik, dan link postingan tetap tersimpan."
                        : "Visual dapat dibuat dengan AI setelah ide konten disetujui."}
                    </p>
                  </div>
                </div>
              )}

              {hasActiveMedia && (
                <div className="crm-media-quick-actions">
                  <button type="button" className="crm-media-action-btn" onClick={() => setShowMediaDetail(true)}>
                    <Maximize2 size={15} />
                    <span>Lihat detail</span>
                  </button>
                  <button
                    type="button"
                    className="crm-media-action-btn primary"
                    onClick={handleDownloadMedia}
                    disabled={isDownloadingMedia}
                  >
                    {isDownloadingMedia ? <Loader2 className="spin" size={15} /> : <Download size={15} />}
                    <span>{isDownloadingMedia ? "Menyiapkan..." : `Unduh ${isVideo ? "video" : "gambar"}`}</span>
                  </button>
                </div>
              )}

              <div className={`crm-detail-status-banner ${statusMeta.color}`}>
                <AlertCircle size={16} />
                <div>
                  <strong>{statusMeta.label}</strong>
                  <p>{statusMeta.desc}</p>
                </div>
              </div>
            </div>

            <div className="crm-detail-info-column">
              {concept.hook && (
                <section className="crm-detail-block crm-detail-surface crm-detail-hook-section">
                  <span className="crm-detail-label">Hook / Pembuka</span>
                  <div className="crm-detail-hook-box">
                    &ldquo;{concept.hook}&rdquo;
                  </div>
                </section>
              )}

              <section className="crm-detail-block crm-detail-surface">
                <span className="crm-detail-label">Caption Lengkap</span>
                <div className="crm-detail-caption-box">
                  {concept.initialCaption || "Belum ada caption."}
                </div>
              </section>

              {concept.hashtags && concept.hashtags.length > 0 && (
                <section className="crm-detail-block crm-detail-surface">
                  <span className="crm-detail-label">Hashtags</span>
                  <div className="crm-hashtags-cloud">
                    {concept.hashtags.map((tag, idx) => (
                      <span key={idx} className="crm-hashtag-badge">
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {concept.visualPrompt && (
                <section className="crm-detail-block crm-detail-surface">
                  <span className="crm-detail-label">Prompt Visual</span>
                  <div className="crm-detail-caption-box" style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" }}>{concept.visualPrompt}</div>
                  <div className="crm-format-pills" style={{ marginTop: 12 }}>
                    <button type="button" className="crm-format-pill" onClick={copyPrompt}><Clipboard size={14} />{promptCopied ? "Tersalin" : "Salin Prompt"}</button>
                    <a className="crm-format-pill" href="https://chatgpt.com/" target="_blank" rel="noreferrer"><ExternalLink size={14} />Buka ChatGPT</a>
                    <a className="crm-format-pill" href="https://gemini.google.com/" target="_blank" rel="noreferrer"><ExternalLink size={14} />Buka Gemini</a>
                  </div>
                  {concept.referenceAssets.length > 0 && <div className="crm-format-pills" style={{ marginTop: 10 }}>{concept.referenceAssets.map((asset, index) => asset.url ? <a key={asset.id} className="crm-format-pill" href={asset.url} target="_blank" rel="noreferrer"><Download size={14} />Referensi {index + 1}</a> : null)}</div>}
                  <input ref={visualInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleVisualUpload} />
                  <button type="button" className="crm-btn crm-btn-secondary" style={{ marginTop: 12 }} onClick={() => visualInputRef.current?.click()} disabled={isUploadingVisual}>{isUploadingVisual ? <Loader2 className="spin" size={14} /> : <Upload size={14} />}<span>{isUploadingVisual ? "Mengunggah..." : "Upload Hasil dari AI"}</span></button>
                </section>
              )}

              <section className="crm-detail-metadata-section">
                <div className="crm-detail-section-heading compact">
                  <div>
                    <span className="crm-detail-kicker">Informasi konten</span>
                    <strong>Detail publikasi</strong>
                  </div>
                </div>
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
                      : concept.generationMode === "ASSISTED"
                      ? "✨ Full AI · Mode Hemat"
                      : "🤖 Full AI · Mode Otomatis"}
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
              </section>

              {error && (
                <div className="crm-alert-toast error" style={{ marginTop: "12px" }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

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
              {canRegenerateIdea && (
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
                  <span>Coba Lagi Susun Ide</span>
                </button>
              )}

              {/* Action 1: If in FINAL_REVIEW or HELD -> Allow Revision */}
              {(concept.state === "FINAL_REVIEW" ||
                (["HELD", "FAILED"].includes(concept.state) && Boolean(concept.mediaAsset))) && (
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
              {(concept.state === "IDEA_APPROVED" || canRetryMedia) && (
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
                  <span>{canRetryMedia ? "Coba Lagi Buat Visual" : "Generate Gambar AI"}</span>
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
                <span>Setujui & Jadwalkan</span>
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
                  Tahan Publikasi
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>

      {showMediaDetail && hasActiveMedia && concept.mediaAsset?.url && (
        <div
          className="crm-media-detail-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowMediaDetail(false);
          }}
        >
          <div
            className="crm-media-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Detail ${isVideo ? "video" : "gambar"}: ${displayTopic}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="crm-media-detail-header">
              <div>
                <span className="crm-detail-kicker">{isVideo ? "Preview video" : "Preview gambar"}</span>
                <h3>{displayTopic}</h3>
              </div>
              <div className="crm-media-detail-header-actions">
                <button
                  type="button"
                  className="crm-media-detail-download"
                  onClick={handleDownloadMedia}
                  disabled={isDownloadingMedia}
                >
                  {isDownloadingMedia ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
                  <span>{isDownloadingMedia ? "Menyiapkan..." : "Unduh"}</span>
                </button>
                <button
                  type="button"
                  className="crm-media-detail-close"
                  onClick={() => setShowMediaDetail(false)}
                  aria-label="Tutup detail media"
                >
                  <X size={20} />
                </button>
              </div>
            </header>
            <div className="crm-media-detail-stage">
              {isVideo ? (
                <video
                  src={concept.mediaAsset.url}
                  controls
                  autoPlay
                  playsInline
                  className="crm-media-detail-content"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={concept.mediaAsset.url}
                  alt={displayTopic}
                  className="crm-media-detail-content"
                />
              )}
            </div>
            {error && (
              <div className="crm-media-detail-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      )}

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
