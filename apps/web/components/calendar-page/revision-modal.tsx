"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Paintbrush, Sparkles, X } from "lucide-react";
import type { CalendarConceptItem } from "@/app/api/calendar/route";

interface RevisionModalProps {
  concept: CalendarConceptItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function RevisionModal({ concept, onClose, onSuccess }: RevisionModalProps) {
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevise(e: React.FormEvent) {
    e.preventDefault();
    if (!instructions.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/concepts/${concept.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: instructions.trim() })
      });
      const data = (await res.json()) as { success?: boolean; message?: string };

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal meminta revisi.");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses revisi.");
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
        style={{ maxWidth: "560px" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="crm-modal-header">
          <div className="crm-modal-icon-wrap" style={{ background: "#FEF3C7", color: "#D97706" }}>
            <Paintbrush size={20} />
          </div>
          <div className="crm-modal-title-wrap">
            <span className="crm-modal-eyebrow">REVISI VISUAL AI</span>
            <h2 className="crm-modal-title">Revisi Gambar / Media Konten</h2>
            <p className="crm-modal-desc">
              Masukkan perintah revisi untuk memberi tahu AI bagian mana yang perlu diperbaiki atau diubah.
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

        <form onSubmit={handleRevise} className="crm-modal-form">
          <div className="crm-form-group">
            <label className="crm-label">Topik Konten</label>
            <div className="crm-static-field">{concept.topic}</div>
          </div>

          <div className="crm-form-group">
            <label className="crm-label">Instruksi Revisi untuk AI *</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Contoh: Ganti background menjadi warna biru langit yang cerah, tambahkan ilustrasi laptop di atas meja, dan buat suasana lebih profesional."
              rows={4}
              className="crm-textarea"
              required
              autoFocus
            />
            <span className="crm-field-hint">
              AI akan membaca konsep awal dan menerapkan instruksi perbaikan ini pada gambar baru.
            </span>
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
              disabled={loading || !instructions.trim()}
              className="crm-btn crm-btn-primary"
              style={{ background: "#D97706" }}
            >
              {loading ? (
                <>
                  <Loader2 className="spin" size={15} />
                  <span>Memproses Revisi...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Generate Ulang Gambar</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
