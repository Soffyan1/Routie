"use client";

import { useRef, useState } from "react";
import { AlertCircle, Check, Hash, ImagePlus, Loader2, Plus, Sparkles, UploadCloud, Wand2, X } from "lucide-react";

interface CreateContentModalProps { initialDate?: string | undefined; onClose: () => void; onSuccess: () => void; }
const channelsList = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "THREADS", "YOUTUBE", "X"] as const;
const channelLabels = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TIKTOK: "TikTok", THREADS: "Threads", YOUTUBE: "YouTube Shorts", X: "X (Twitter)" } as const;

export function CreateContentModal({ initialDate, onClose, onSuccess }: CreateContentModalProps) {
  const [tab, setTab] = useState<"FULL_AI" | "SEMI_AI" | "MANUAL">("FULL_AI");
  const [fullAiMode, setFullAiMode] = useState<"ASSISTED" | "AUTOMATIC">("ASSISTED");
  const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]!);
  const [time, setTime] = useState("09:00");
  const [channels, setChannels] = useState<string[]>(["INSTAGRAM", "TIKTOK"]);
  const [kind, setKind] = useState<"IMAGE" | "CAROUSEL" | "SHORT_VIDEO" | "STORY">("IMAGE");
  const [contentRequest, setContentRequest] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [topic, setTopic] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [contentPillar, setContentPillar] = useState("Edukasi & Tips");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manualInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);

  function toggleChannel(channel: string) { setChannels((value) => value.includes(channel) ? value.filter((item) => item !== channel) : [...value, channel]); }
  function selectManualFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return setError("File harus berupa gambar atau video.");
    setUploadFile(file); setUploadPreview(URL.createObjectURL(file)); setError(null);
  }
  function selectReferences(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 3);
    if (files.some((file) => !/^image\/(png|jpeg|webp)$/.test(file.type))) return setError("Referensi harus berupa PNG, JPG, atau WebP.");
    setReferenceFiles(files); setError(null);
  }
  async function uploadAsset(file: File, usage: "reference" | "manual") {
    const video = file.type.startsWith("video/"); const contentType = file.type || (video ? "video/mp4" : "image/jpeg");
    const urlResponse = await fetch("/api/assets/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType, sizeBytes: file.size }) });
    const urlData = await urlResponse.json() as { objectKey?: string; uploadUrl?: string; message?: string };
    if (!urlResponse.ok || !urlData.objectKey || !urlData.uploadUrl) throw new Error(urlData.message || "Gagal menyiapkan upload media.");
    const putResponse = await fetch(urlData.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    if (!putResponse.ok) throw new Error("Gagal mengunggah media.");
    const completeResponse = await fetch("/api/assets/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objectKey: urlData.objectKey, kind: video ? "VIDEO" : "IMAGE", contentType, sizeBytes: file.size, checksum: `sha256-${usage}-${Date.now()}-${file.size}`, metadata: { filename: file.name, usage: usage === "reference" ? "CONTENT_REFERENCE" : "MANUAL_UPLOAD" } }) });
    const completeData = await completeResponse.json() as { asset?: { id: string }; message?: string };
    if (!completeResponse.ok || !completeData.asset?.id) throw new Error(completeData.message || "Gagal mencatat media.");
    return { id: completeData.asset.id, objectKey: urlData.objectKey, contentType, sizeBytes: file.size };
  }
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!channels.length) return setError("Pilih minimal satu channel media sosial tujuan.");
    if (tab === "FULL_AI" && !contentRequest.trim()) return setError("Ceritakan konten apa yang ingin dibuat hari ini.");
    setLoading(true); setError(null);
    try {
      setUploading(Boolean(uploadFile || referenceFiles.length));
      const references = tab === "FULL_AI" ? await Promise.all(referenceFiles.map((file) => uploadAsset(file, "reference"))) : [];
      const manual = tab === "MANUAL" && uploadFile ? await uploadAsset(uploadFile, "manual") : null;
      const hashtags = hashtagsText.split(/\s+/).map((value) => value.trim()).filter(Boolean).map((value) => value.startsWith("#") ? value : `#${value}`);
      const effectiveKind = uploadFile?.type.startsWith("video/") || channels.includes("YOUTUBE") ? "SHORT_VIDEO" : kind;
      const response = await fetch("/api/calendar/slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: tab, fullAiMode: tab === "FULL_AI" ? fullAiMode : undefined, contentRequest: tab === "FULL_AI" ? contentRequest.trim() : undefined, referenceAssetIds: references.map((item) => item.id), localDate: date, localTime: time, timezone: "Asia/Jakarta", channels, recommendedKind: effectiveKind, useWebSearch: tab === "FULL_AI" && fullAiMode === "AUTOMATIC" ? useWebSearch : false, topic: topic.trim() || undefined, initialCaption: caption.trim() || undefined, hashtags, contentPillar: contentPillar.trim() || undefined, objectKey: manual?.objectKey, mimeType: manual?.contentType, sizeBytes: manual?.sizeBytes }) });
      const data = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message || "Gagal membuat jadwal konten.");
      onSuccess(); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Terjadi kesalahan saat membuat konten."); }
    finally { setLoading(false); setUploading(false); }
  }

  return <div className="crm-modal-backdrop" role="presentation" onMouseDown={() => !loading && onClose()}>
    <div className="crm-modal-container" role="dialog" aria-modal="true" style={{ maxWidth: 720 }} onMouseDown={(event) => event.stopPropagation()}>
      <header className="crm-modal-header"><div className="crm-modal-icon-wrap" style={{ background: "#EEF2FF", color: "#4F46E5" }}><Sparkles size={20} /></div><div className="crm-modal-title-wrap"><span className="crm-modal-eyebrow">CONTENT PLANNER</span><h2 className="crm-modal-title">Buat Konten Baru</h2><p className="crm-modal-desc">Rencanakan ide, visual, dan jadwal konten dalam satu alur.</p></div><button type="button" className="crm-modal-close-btn" aria-label="Tutup" onClick={onClose} disabled={loading}><X size={18} /></button></header>
      <div className="crm-tab-bar">{([["FULL_AI", Sparkles, "1. Full AI"], ["SEMI_AI", Wand2, "2. Semi AI"], ["MANUAL", ImagePlus, "3. Manual + Upload"]] as const).map(([value, Icon, label]) => <button key={value} type="button" className={`crm-tab-btn ${tab === value ? "active" : ""}`} onClick={() => { setTab(value); setError(null); }}><Icon size={14} /><span>{label}</span></button>)}</div>
      <form onSubmit={handleSubmit} className="crm-modal-form">
        <div className="crm-form-grid-2"><div className="crm-form-group"><label className="crm-label">Tanggal Tayang *</label><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="crm-input" required /></div><div className="crm-form-group"><label className="crm-label">Jam Tayang (WIB) *</label><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="crm-input" required /></div></div>
        <div className="crm-form-group"><label className="crm-label">Channel Media Sosial Tujuan *</label><div className="crm-channel-tiles-grid">{channelsList.map((channel) => { const selected = channels.includes(channel); return <button key={channel} type="button" className={`crm-channel-tile ${selected ? "selected" : ""}`} onClick={() => toggleChannel(channel)}><div className="crm-tile-checkbox">{selected && <Check size={12} />}</div><span className="crm-tile-name">{channelLabels[channel]}</span></button>; })}</div></div>
        <div className="crm-form-group"><label className="crm-label">Format Konten</label><div className="crm-format-pills">{(["IMAGE", "CAROUSEL", "SHORT_VIDEO", "STORY"] as const).map((format) => <button key={format} type="button" className={`crm-format-pill ${kind === format ? "selected" : ""}`} onClick={() => setKind(format)}>{format === "IMAGE" ? "🖼️ Post Feed (1:1)" : format === "CAROUSEL" ? "📚 Carousel Slide" : format === "SHORT_VIDEO" ? "🎬 Video Reels / TikTok" : "📱 Story Vertikal (9:16)"}</button>)}</div></div>
        {tab === "FULL_AI" && <>
          <div className="crm-form-group"><label className="crm-label">Konten apa yang ingin dibuat hari ini? *</label><textarea className="crm-textarea" rows={4} value={contentRequest} onChange={(event) => setContentRequest(event.target.value)} placeholder="Contoh: Buat konten edukasi tentang perbedaan kopi Arabika dan Robusta dengan bahasa santai." /><span className="crm-toggle-desc">Routie menggabungkan arahan ini dengan Brand Identity workspace Anda.</span></div>
          <div className="crm-feature-toggle-card" style={{ margin: 0, alignItems: "flex-start" }}><div className="crm-toggle-info"><span className="crm-toggle-title">Pilih cara membuat visual</span><span className="crm-toggle-desc">Hemat menyiapkan ide dan prompt untuk AI Anda. Otomatis membuat visual langsung di Routie.</span></div><div className="crm-format-pills"><button type="button" className={`crm-format-pill ${fullAiMode === "ASSISTED" ? "selected" : ""}`} onClick={() => setFullAiMode("ASSISTED")}>Hemat</button><button type="button" className={`crm-format-pill ${fullAiMode === "AUTOMATIC" ? "selected" : ""}`} onClick={() => setFullAiMode("AUTOMATIC")}>Otomatis</button></div></div>
          <div className="crm-form-group"><label className="crm-label">Referensi visual (opsional, maksimal 3)</label><input ref={referenceInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={selectReferences} /><div className="crm-upload-dropzone" onClick={() => referenceInput.current?.click()}><UploadCloud size={28} className="crm-upload-icon" /><b>{referenceFiles.length ? `${referenceFiles.length} referensi dipilih` : "Tambahkan contoh gaya atau gambar acuan"}</b><span>PNG, JPG, atau WebP. Referensi ikut dipakai untuk menyusun prompt.</span></div>{referenceFiles.length > 0 && <div className="crm-format-pills">{referenceFiles.map((file) => <span key={`${file.name}-${file.size}`} className="crm-format-pill selected">{file.name}</span>)}</div>}</div>
          {fullAiMode === "AUTOMATIC" && <div className="crm-feature-toggle-card" style={{ margin: 0 }}><input id="webSearchToggleModal" type="checkbox" checked={useWebSearch} onChange={(event) => setUseWebSearch(event.target.checked)} /><label htmlFor="webSearchToggleModal"><div className="crm-toggle-info"><span className="crm-toggle-title">Gunakan riset web realtime</span><span className="crm-toggle-desc">Opsional untuk tren terbaru; membutuhkan integrasi AI yang mendukung web.</span></div></label></div>}
        </>}
        {(tab === "SEMI_AI" || tab === "MANUAL") && <><div className="crm-form-group"><label className="crm-label">{tab === "SEMI_AI" ? "Topik / Konsep Konten *" : "Judul / Topik Postingan *"}</label><input className="crm-input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Contoh: 5 Tips Mengatur Budget Liburan" required /></div><div className="crm-form-group"><label className="crm-label">Caption Postingan</label><textarea className="crm-textarea" rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Tulis caption atau arahan konten..." /></div><div className="crm-form-grid-2"><div className="crm-form-group"><label className="crm-label"><Hash size={13} style={{ display: "inline", marginRight: 4 }} />Hashtags</label><input className="crm-input" value={hashtagsText} onChange={(event) => setHashtagsText(event.target.value)} placeholder="#travel #tips" /></div><div className="crm-form-group"><label className="crm-label">Pilar Konten</label><input className="crm-input" value={contentPillar} onChange={(event) => setContentPillar(event.target.value)} /></div></div></>}
        {tab === "MANUAL" && <div className="crm-form-group"><label className="crm-label">Unggah Gambar atau Video (opsional)</label><input ref={manualInput} type="file" accept="image/*,video/*" hidden onChange={selectManualFile} />{uploadPreview ? <div className="crm-upload-preview-box"><img src={uploadPreview} alt="Preview" className="crm-upload-thumb" /><div className="crm-upload-file-meta"><b>{uploadFile?.name}</b><span>{((uploadFile?.size || 0) / 1024 / 1024).toFixed(2)} MB</span></div><button type="button" className="crm-btn crm-btn-secondary" onClick={() => manualInput.current?.click()}>Ganti File</button></div> : <div className="crm-upload-dropzone" onClick={() => manualInput.current?.click()}><UploadCloud size={32} className="crm-upload-icon" /><b>Klik untuk memilih media</b><span>JPG, PNG, WebP, atau video</span></div>}</div>}
        {error && <div className="crm-alert-toast error"><AlertCircle size={16} /><span>{error}</span></div>}
        <footer className="crm-modal-footer"><button type="button" className="crm-btn crm-btn-secondary" onClick={onClose} disabled={loading}>Batal</button><button type="submit" className="crm-btn crm-btn-primary" disabled={loading || !channels.length}>{loading ? <><Loader2 className="spin" size={15} /><span>{uploading ? "Mengunggah referensi..." : "Menyiapkan konten..."}</span></> : <><Plus size={15} /><span>{tab === "FULL_AI" ? fullAiMode === "ASSISTED" ? "Susun Ide & Prompt" : "Generate Ide & Visual" : tab === "SEMI_AI" ? "Simpan & Generate Visual" : "Jadwalkan Konten"}</span></>}</button></footer>
      </form>
    </div>
  </div>;
}
