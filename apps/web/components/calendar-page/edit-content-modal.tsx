"use client";

import { useState } from "react";
import { AlertCircle, Edit3, Hash, Loader2, Save, X } from "lucide-react";
import type { CalendarConceptItem } from "@/app/api/calendar/route";

interface EditContentModalProps {
  concept: CalendarConceptItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditContentModal({ concept, onClose, onSuccess }: EditContentModalProps) {
  const [topic, setTopic] = useState(concept.topic);
  const [initialCaption, setInitialCaption] = useState(concept.initialCaption);
  const [hashtagsText, setHashtagsText] = useState((concept.hashtags || []).join(" "));
  const [contentPillar, setContentPillar] = useState(concept.contentPillar || "Umum");
  const [hook, setHook] = useState(concept.hook || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);

    const parsedHashtags = hashtagsText
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));

    try {
      const res = await fetch(`/api/concepts/${concept.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          initialCaption: initialCaption.trim(),
          hashtags: parsedHashtags,
          contentPillar: contentPillar.trim(),
          hook: hook.trim(),
          expectedVersion: concept.version
        })
      });
      const data = (await res.json()) as { concept?: unknown; message?: string };

      if (!res.ok) {
        throw new Error(data.message || "Gagal menyimpan perubahan.");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="crm-modal-backdrop" role="presentation" onMouseDown={() => !loading && onClose()}>
      <div
        className="crm-modal-container"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: "600px" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="crm-modal-header">
          <div className="crm-modal-icon-wrap" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
            <Edit3 size={20} />
          </div>
          <div className="crm-modal-title-wrap">
            <span className="crm-modal-eyebrow">EDIT KONTEN</span>
            <h2 className="crm-modal-title">Edit Teks & Detail Konten</h2>
            <p className="crm-modal-desc">
              Perbarui topik, caption, hashtag, atau pilar konten sebelum diterbitkan.
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

        <form onSubmit={handleSave} className="crm-modal-form">
          <div className="crm-form-group">
            <label className="crm-label">Topik Konten *</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="crm-input"
              required
            />
          </div>

          <div className="crm-form-group">
            <label className="crm-label">Hook / Pembuka</label>
            <input
              type="text"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              className="crm-input"
              placeholder="Contoh: Ini 3 rahasia travel hemat yang jarang diketahui..."
            />
          </div>

          <div className="crm-form-group">
            <label className="crm-label">Caption Lengkap</label>
            <textarea
              value={initialCaption}
              onChange={(e) => setInitialCaption(e.target.value)}
              rows={4}
              className="crm-textarea"
              placeholder="Tulis caption postingan..."
            />
          </div>

          <div className="crm-form-group">
            <label className="crm-label">
              <Hash size={13} style={{ display: "inline", marginRight: "4px" }} />
              Hashtags (Pisahkan dengan spasi)
            </label>
            <input
              type="text"
              value={hashtagsText}
              onChange={(e) => setHashtagsText(e.target.value)}
              className="crm-input"
              placeholder="#tips #travel #kuliner #lifestyle"
            />
          </div>

          <div className="crm-form-group">
            <label className="crm-label">Pilar Konten</label>
            <input
              type="text"
              value={contentPillar}
              onChange={(e) => setContentPillar(e.target.value)}
              className="crm-input"
              placeholder="Edukasi / Hiburan / Promosi"
            />
          </div>

          {error && (
            <div className="crm-alert-toast error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

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
              disabled={loading || !topic.trim()}
              className="crm-btn crm-btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="spin" size={15} />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
