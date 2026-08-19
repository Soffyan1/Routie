"use client";

import { useState } from "react";
import { ArrowRight, Check, CheckCircle2, FileUp, Loader2, Palette, Target, UploadCloud } from "lucide-react";

export function OnboardingForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.get("businessName"),
          brief: form.get("brief"),
          targetAudience: form.get("targetAudience"),
          tone: form.get("tone"),
          prohibitedClaims: String(form.get("prohibitedClaims") ?? "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          callsToAction: ["Kunjungi website", "Hubungi kami"],
          colors: ["#4F46E5", "#0F172A"],
          contentPillars: [
            { name: "Edukasi", percentage: 40 },
            { name: "Engagement", percentage: 30 },
            { name: "Promosi", percentage: 30 }
          ]
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Profil belum dapat disimpan");
      setStatus("saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kesalahan");
      setStatus("error");
    }
  }

  return (
    <form className="crm-wizard-form-stack" onSubmit={submit}>
      {/* Section 01: Brand Identity */}
      <div className="crm-card crm-wizard-section-card">
        <div className="crm-wizard-section-head">
          <div className="crm-wizard-section-num">01</div>
          <div className="crm-wizard-section-info">
            <h3 className="crm-wizard-section-title">Ceritakan Profil & Model Bisnismu</h3>
            <p className="crm-wizard-section-desc">
              Informasi dasar ini menjadi pedoman utama (ground truth) untuk setiap ide konten yang digenerate AI.
            </p>
          </div>
        </div>

        <div className="crm-wizard-fields">
          <div className="crm-form-group">
            <label className="crm-label">Nama Bisnis / Brand</label>
            <input
              name="businessName"
              placeholder="Contoh: Nusa Roastery & Cafe"
              required
              minLength={2}
              className="crm-input"
            />
          </div>

          <div className="crm-form-group">
            <label className="crm-label">Deskripsi Singkat & Value Proposition</label>
            <textarea
              name="brief"
              placeholder="Apa yang kamu tawarkan, siapa target utamanya, dan apa keunggulan unik produkmu..."
              required
              minLength={20}
              rows={4}
              className="crm-textarea"
            />
          </div>

          <div className="crm-form-grid-2">
            <div className="crm-form-group">
              <label className="crm-label">Target Audiens Utama</label>
              <input
                name="targetAudience"
                placeholder="Contoh: Profesional muda, usia 22–35 tahun..."
                required
                className="crm-input"
              />
            </div>
            <div className="crm-form-group">
              <label className="crm-label">Tone of Voice (Gaya Bahasa)</label>
              <input
                name="tone"
                placeholder="Contoh: Hangat, solutif, percaya diri, kasual..."
                required
                className="crm-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 02: Guidelines & Assets */}
      <div className="crm-card crm-wizard-section-card">
        <div className="crm-wizard-section-head">
          <div className="crm-wizard-section-num">02</div>
          <div className="crm-wizard-section-info">
            <h3 className="crm-wizard-section-title">Batasan Klaim & Aset Visual Brand</h3>
            <p className="crm-wizard-section-desc">
              Tentukan larangan konten dan unggah pedoman visual agar format output selaras dengan brand identity.
            </p>
          </div>
        </div>

        <div className="crm-wizard-fields">
          <div className="crm-form-group">
            <label className="crm-label">Klaim atau Topik yang Dilarang (Guardrails)</label>
            <textarea
              name="prohibitedClaims"
              placeholder="Satu aturan per baris&#10;Contoh: Jangan membuat klaim menyembuhkan tanpa izin resmi&#10;Jangan bandingkan dengan kompetitor secara vulgar"
              rows={3}
              className="crm-textarea"
            />
          </div>

          <div className="crm-asset-upload-zone">
            <div className="crm-asset-upload-icon">
              <UploadCloud size={24} />
            </div>
            <div className="crm-asset-upload-info">
              <b>Unggah Logo, Foto Produk, Font, atau Brand Guidelines</b>
              <span>Format didukung: PNG, JPG, SVG, PDF, DOCX (Penyimpanan S3 aman hingga 20 GB)</span>
            </div>
            <button type="button" className="crm-btn crm-btn-secondary">
              <FileUp size={14} />
              <span>Pilih File</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Submission Bar */}
      <div className="crm-wizard-footer">
        <div className="crm-wizard-footer-status">
          {status === "saved" && (
            <span className="crm-status-toast-row success">
              <CheckCircle2 size={15} />
              <span>Profil brand berhasil disimpan ke database workspace.</span>
            </span>
          )}
          {status === "error" && (
            <span className="crm-status-toast-row error">
              <span>{error}</span>
            </span>
          )}
        </div>
        <button
          type="submit"
          className="crm-btn crm-btn-primary large"
          disabled={status === "saving"}
        >
          {status === "saving" ? (
            <>
              <Loader2 className="spin" size={16} />
              <span>Menyimpan Profil...</span>
            </>
          ) : (
            <>
              <span>Simpan & Lanjutkan</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
