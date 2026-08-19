"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  FileImage,
  Globe,
  Hash,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  Send,
  Sparkles,
  UploadCloud,
  Wand2,
  X
} from "lucide-react";

interface CreateContentModalProps {
  initialDate?: string | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

const channelsList = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "THREADS", "YOUTUBE", "X"] as const;
const channelLabels: Record<(typeof channelsList)[number], string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  THREADS: "Threads",
  YOUTUBE: "YouTube Shorts",
  X: "X (Twitter)"
};

export function CreateContentModal({
  initialDate,
  onClose,
  onSuccess
}: CreateContentModalProps) {
  const [tab, setTab] = useState<"FULL_AI" | "SEMI_AI" | "MANUAL">("FULL_AI");
  const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]!);
  const [time, setTime] = useState("09:00");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["INSTAGRAM", "TIKTOK"]);
  const [recommendedKind, setRecommendedKind] = useState<"IMAGE" | "CAROUSEL" | "SHORT_VIDEO" | "STORY">("IMAGE");
  const [useWebSearch, setUseWebSearch] = useState(false);

  // For Semi-AI & Manual
  const [topic, setTopic] = useState("");
  const [hook, setHook] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [contentPillar, setContentPillar] = useState("Edukasi & Tips");

  // For Manual Upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleChannel(ch: string) {
    setSelectedChannels((curr) =>
      curr.includes(ch) ? curr.filter((c) => c !== ch) : [...curr, ch]
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setError("File harus berupa gambar (PNG, JPG, WebP) atau video.");
        return;
      }
      setUploadFile(file);
      setUploadPreview(URL.createObjectURL(file));
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedChannels.length === 0) {
      setError("Pilih minimal satu channel media sosial tujuan.");
      return;
    }

    setLoading(true);
    setError(null);

    const parsedHashtags = hashtagsText
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));

    try {
      let uploadedKey: string | undefined;
      let uploadedMime: string | undefined;
      let uploadedSize: number | undefined;

      // Handle Manual Upload to MinIO
      if (tab === "MANUAL" && uploadFile) {
        setUploading(true);
        // Step 1: Request presigned upload URL
        const urlRes = await fetch("/api/assets/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: uploadFile.name,
            contentType: uploadFile.type === "image/png" ? "image/png" : "image/jpeg",
            sizeBytes: uploadFile.size
          })
        });
        const urlData = (await urlRes.json()) as { objectKey?: string; uploadUrl?: string; message?: string };
        if (!urlRes.ok || !urlData.uploadUrl || !urlData.objectKey) {
          throw new Error(urlData.message || "Gagal mendapatkan URL upload penyimpanan.");
        }

        // Step 2: PUT file directly to S3/MinIO
        const putRes = await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": uploadFile.type },
          body: uploadFile
        });
        if (!putRes.ok) {
          throw new Error("Gagal mengunggah file gambar ke server storage.");
        }

        // Step 3: Complete registration
        await fetch("/api/assets/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectKey: urlData.objectKey,
            kind: "IMAGE",
            contentType: uploadFile.type,
            sizeBytes: uploadFile.size,
            checksum: `sha256-manual-${Date.now()}`
          })
        });

        uploadedKey = urlData.objectKey;
        uploadedMime = uploadFile.type;
        uploadedSize = uploadFile.size;
        setUploading(false);
      }

      // Step 4: Create slot & concept via /api/calendar/slots
      const res = await fetch("/api/calendar/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: tab,
          localDate: date,
          localTime: time,
          timezone: "Asia/Jakarta",
          channels: selectedChannels,
          recommendedKind,
          useWebSearch: tab === "FULL_AI" ? useWebSearch : false,
          topic: topic.trim() || undefined,
          hook: hook.trim() || undefined,
          initialCaption: caption.trim() || undefined,
          hashtags: parsedHashtags,
          contentPillar: contentPillar.trim() || undefined,
          objectKey: uploadedKey,
          mimeType: uploadedMime,
          sizeBytes: uploadedSize
        })
      });

      const data = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal membuat jadwal konten.");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat membuat konten.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  return (
    <div className="crm-modal-backdrop" role="presentation" onMouseDown={() => !loading && onClose()}>
      <div
        className="crm-modal-container"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: "680px" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="crm-modal-header">
          <div className="crm-modal-icon-wrap" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
            <Sparkles size={20} />
          </div>
          <div className="crm-modal-title-wrap">
            <span className="crm-modal-eyebrow">CONTENT PLANNER</span>
            <h2 className="crm-modal-title">Buat Konten Baru</h2>
            <p className="crm-modal-desc">
              Rencanakan dan jadwalkan konten untuk tanggal yang dipilih di kalender.
            </p>
          </div>
          <button
            type="button"
            className="crm-modal-close-btn"
            aria-label="Tutup"
            onClick={onClose}
            disabled={loading}
          >
            <X size={18} />
          </button>
        </header>

        {/* Tab Selector */}
        <div className="crm-tab-bar">
          <button
            type="button"
            className={`crm-tab-btn ${tab === "FULL_AI" ? "active" : ""}`}
            onClick={() => {
              setTab("FULL_AI");
              setError(null);
            }}
          >
            <Sparkles size={14} />
            <span>1. Full AI (Otomatis)</span>
          </button>
          <button
            type="button"
            className={`crm-tab-btn ${tab === "SEMI_AI" ? "active" : ""}`}
            onClick={() => {
              setTab("SEMI_AI");
              setError(null);
            }}
          >
            <Wand2 size={14} />
            <span>2. Semi AI (Ide Anda)</span>
          </button>
          <button
            type="button"
            className={`crm-tab-btn ${tab === "MANUAL" ? "active" : ""}`}
            onClick={() => {
              setTab("MANUAL");
              setError(null);
            }}
          >
            <ImagePlus size={14} />
            <span>3. Manual + Upload</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="crm-modal-form">
          {/* Row: Date & Time */}
          <div className="crm-form-grid-2">
            <div className="crm-form-group">
              <label className="crm-label">Tanggal Tayang *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="crm-input"
                required
              />
            </div>
            <div className="crm-form-group">
              <label className="crm-label">Jam Tayang (WIB) *</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="crm-input"
                required
              />
            </div>
          </div>

          {/* Social Channels Selection */}
          <div className="crm-form-group">
            <label className="crm-label">Channel Media Sosial Tujuan *</label>
            <div className="crm-channel-tiles-grid">
              {channelsList.map((ch) => {
                const isSelected = selectedChannels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    className={`crm-channel-tile ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleChannel(ch)}
                  >
                    <div className="crm-tile-checkbox">
                      {isSelected && <Check size={12} />}
                    </div>
                    <span className="crm-tile-name">{channelLabels[ch]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format selection */}
          <div className="crm-form-group">
            <label className="crm-label">Format Konten</label>
            <div className="crm-format-pills">
              {(["IMAGE", "CAROUSEL", "SHORT_VIDEO", "STORY"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={`crm-format-pill ${recommendedKind === fmt ? "selected" : ""}`}
                  onClick={() => setRecommendedKind(fmt)}
                >
                  {fmt === "IMAGE" && "🖼️ Post Feed (1:1)"}
                  {fmt === "CAROUSEL" && "📚 Carousel Slide"}
                  {fmt === "SHORT_VIDEO" && "🎬 Video Reels / TikTok"}
                  {fmt === "STORY" && "📱 Story Vertikal (9:16)"}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: FULL AI SPECIFIC */}
          {tab === "FULL_AI" && (
            <div className="crm-feature-toggle-card" style={{ marginTop: "4px" }}>
              <input
                id="webSearchToggleModal"
                type="checkbox"
                checked={useWebSearch}
                onChange={(e) => setUseWebSearch(e.target.checked)}
              />
              <label htmlFor="webSearchToggleModal">
                <div className="crm-toggle-info">
                  <span className="crm-toggle-title">Gunakan Riset Web Realtime (Google Search)</span>
                  <span className="crm-toggle-desc">
                    AI akan mencari tren viral dan fakta aktual terbaru sebagai bahan ide konten hari ini.
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* TAB 2 & 3: TOPIC & CAPTION INPUTS */}
          {(tab === "SEMI_AI" || tab === "MANUAL") && (
            <>
              <div className="crm-form-group">
                <label className="crm-label">
                  {tab === "SEMI_AI" ? "Topik / Konsep Konten *" : "Judul / Topik Postingan *"}
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Contoh: 5 Tips Mengatur Budget Liburan Tanpa Bikin Kantong Bolong"
                  className="crm-input"
                  required
                />
              </div>

              <div className="crm-form-group">
                <label className="crm-label">Caption Postingan</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  placeholder={
                    tab === "SEMI_AI"
                      ? "Tulis draf caption atau deskripsi visual yang diinginkan agar AI membuatkan gambar yang pas..."
                      : "Tulis caption lengkap postingan Anda..."
                  }
                  className="crm-textarea"
                />
              </div>

              <div className="crm-form-grid-2">
                <div className="crm-form-group">
                  <label className="crm-label">
                    <Hash size={13} style={{ display: "inline", marginRight: "4px" }} />
                    Hashtags
                  </label>
                  <input
                    type="text"
                    value={hashtagsText}
                    onChange={(e) => setHashtagsText(e.target.value)}
                    placeholder="#travel #budget #tips"
                    className="crm-input"
                  />
                </div>
                <div className="crm-form-group">
                  <label className="crm-label">Pilar Konten</label>
                  <input
                    type="text"
                    value={contentPillar}
                    onChange={(e) => setContentPillar(e.target.value)}
                    className="crm-input"
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 3: FILE UPLOAD BOX */}
          {tab === "MANUAL" && (
            <div className="crm-form-group">
              <label className="crm-label">Unggah Gambar Visual (Opsional)</label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*"
                style={{ display: "none" }}
              />

              {uploadPreview ? (
                <div className="crm-upload-preview-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploadPreview} alt="Preview" className="crm-upload-thumb" />
                  <div className="crm-upload-file-meta">
                    <b>{uploadFile?.name}</b>
                    <span>{((uploadFile?.size || 0) / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary"
                    onClick={() => {
                      setUploadFile(null);
                      setUploadPreview(null);
                    }}
                  >
                    Ganti File
                  </button>
                </div>
              ) : (
                <div
                  className="crm-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={32} className="crm-upload-icon" />
                  <b>Klik atau Seret file gambar ke sini</b>
                  <span>Mendukung format JPG, PNG, WebP hingga 50MB</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="crm-alert-toast error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Modal Footer */}
          <footer className="crm-modal-footer">
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || selectedChannels.length === 0}
              className="crm-btn crm-btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="spin" size={15} />
                  <span>{uploading ? "Mengunggah Media..." : "Memproses Jadwal..."}</span>
                </>
              ) : (
                <>
                  {tab === "FULL_AI" ? <Sparkles size={15} /> : <Plus size={15} />}
                  <span>
                    {tab === "FULL_AI"
                      ? "Generate Ide & Jadwalkan"
                      : tab === "SEMI_AI"
                      ? "Simpan & Generate Gambar AI"
                      : "Jadwalkan Konten"}
                  </span>
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
