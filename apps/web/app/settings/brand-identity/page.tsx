"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Palette,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X
} from "lucide-react";

interface ContentPillar {
  name: string;
  percentage: number;
}

interface BrandProfileState {
  businessName: string;
  tagline: string;
  brief: string;
  brandPersona: string;
  niche: string;
  websiteUrl: string;
  targetAudience: string;
  targetAgeMin: number;
  targetAgeMax: number;
  targetGender: string;
  targetLocations: string[];
  tone: string;
  prohibitedClaims: string[];
  callsToAction: string[];
  colors: string[];
  contentPillars: ContentPillar[];
}

const DEFAULT_PROFILE: BrandProfileState = {
  businessName: "Routie Official",
  tagline: "Smart Social Media Scheduling & Growth Automation",
  brief: "Platform otomatisasi dan analitik media sosial berbasis AI untuk brand, agensi, dan konten kreator.",
  brandPersona: "Kamu adalah Senior Social Media Strategist yang ramah, energik, dan to-the-point. Gunakan bahasa Indonesia kasual profesional.",
  niche: "SaaS & Productivity",
  websiteUrl: "https://routie.io",
  targetAudience: "Digital marketer, agency owner, dan content creator usia 20-40 tahun di Indonesia.",
  targetAgeMin: 20,
  targetAgeMax: 40,
  targetGender: "ALL",
  targetLocations: ["Jakarta", "Bandung", "Surabaya", "Indonesia"],
  tone: "Casual & Professional",
  prohibitedClaims: ["Jaminan 100% viral dalam semalam", "Tanpa modal sama sekali", "Pasti masuk Forbes 30 under 30"],
  callsToAction: [
    "🚀 Coba gratis Routie sekarang melalui link di bio!",
    "💬 Komen \"ROUTIE\" di bawah untuk dapat cheat-sheet eksklusif!",
    "📌 Simpan postingan ini agar tidak lupa saat eksekusi nanti!"
  ],
  colors: ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B"],
  contentPillars: [
    { name: "Edukasi & Tutorial", percentage: 40 },
    { name: "Studi Kasus & Fitur", percentage: 30 },
    { name: "Insight & Tren Industri", percentage: 20 },
    { name: "Behind The Scene & Fun", percentage: 10 }
  ]
};

const NICHE_OPTIONS = [
  "SaaS & Productivity",
  "Fashion & Apparel",
  "Food & Beverage (F&B)",
  "Health & Beauty / Skincare",
  "Agency & Digital Marketing",
  "Financial & Investment",
  "Education & Course",
  "Real Estate & Property",
  "Personal Brand / Influencer",
  "Lainnya"
];

const TONE_PRESETS = [
  { label: "Casual & Professional", desc: "Santai tapi berbobot, akrab dan mudah dipahami" },
  { label: "Authoritative & Expert", desc: "Formal, berbasis data, berwibawa tinggi" },
  { label: "Friendly & Playful", desc: "Humoris, ceria, banyak analogi seru" },
  { label: "Inspirational & Bold", desc: "Memotivasi, berani, mendorong aksi nyata" }
];

export default function BrandIdentityPage() {
  const [profile, setProfile] = useState<BrandProfileState>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  // New tag inputs temporary state
  const [newLocation, setNewLocation] = useState("");
  const [newClaim, setNewClaim] = useState("");
  const [newCta, setNewCta] = useState("");
  const [newColor, setNewColor] = useState("#8B5CF6");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/brand-profile");
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfile({
              businessName: data.profile.businessName || DEFAULT_PROFILE.businessName,
              tagline: data.profile.tagline || DEFAULT_PROFILE.tagline,
              brief: data.profile.brief || DEFAULT_PROFILE.brief,
              brandPersona: data.profile.brandPersona || DEFAULT_PROFILE.brandPersona,
              niche: data.profile.niche || DEFAULT_PROFILE.niche,
              websiteUrl: data.profile.websiteUrl || DEFAULT_PROFILE.websiteUrl,
              targetAudience: data.profile.targetAudience || DEFAULT_PROFILE.targetAudience,
              targetAgeMin: data.profile.targetAgeMin ?? 20,
              targetAgeMax: data.profile.targetAgeMax ?? 40,
              targetGender: data.profile.targetGender || "ALL",
              targetLocations: data.profile.targetLocations?.length ? data.profile.targetLocations : DEFAULT_PROFILE.targetLocations,
              tone: data.profile.tone || DEFAULT_PROFILE.tone,
              prohibitedClaims: data.profile.prohibitedClaims?.length ? data.profile.prohibitedClaims : DEFAULT_PROFILE.prohibitedClaims,
              callsToAction: data.profile.callsToAction?.length ? data.profile.callsToAction : DEFAULT_PROFILE.callsToAction,
              colors: data.profile.colors?.length ? data.profile.colors : DEFAULT_PROFILE.colors,
              contentPillars: data.profile.contentPillars?.length ? data.profile.contentPillars : DEFAULT_PROFILE.contentPillars
            });
          }
        }
      } catch {
        // fallback to defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalPillarPercentage = profile.contentPillars.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (totalPillarPercentage !== 100) {
      setSaveStatus({
        success: false,
        message: `Total persentase pilar konten harus tepat 100% (saat ini ${totalPillarPercentage}%).`
      });
      return;
    }

    try {
      setSaving(true);
      setSaveStatus(null);
      const res = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      if (res.ok) {
        setSaveStatus({ success: true, message: "Identitas brand berhasil disimpan dan diperbarui untuk acuan AI." });
      } else {
        setSaveStatus({ success: false, message: data.message || "Gagal menyimpan identitas brand." });
      }
    } catch {
      setSaveStatus({ success: false, message: "Terjadi kesalahan jaringan." });
    } finally {
      setSaving(false);
    }
  }

  function handlePillarChange(index: number, field: "name" | "percentage", value: string | number) {
    const updated = [...profile.contentPillars];
    if (field === "name") {
      updated[index]!.name = String(value);
    } else {
      updated[index]!.percentage = Number(value) || 0;
    }
    setProfile({ ...profile, contentPillars: updated });
  }

  function addPillar() {
    if (profile.contentPillars.length >= 8) return;
    setProfile({
      ...profile,
      contentPillars: [...profile.contentPillars, { name: "Pilar Baru", percentage: 0 }]
    });
  }

  function removePillar(index: number) {
    if (profile.contentPillars.length <= 1) return;
    setProfile({
      ...profile,
      contentPillars: profile.contentPillars.filter((_, i) => i !== index)
    });
  }

  return (
    <div className="crm-settings-card">
      <div className="crm-settings-card-header">
        <div className="crm-settings-title-group">
          <div className="crm-settings-icon-badge purple">
            <Palette size={18} />
          </div>
          <div>
            <h2 className="crm-settings-title">Identitas & Panduan Brand (Brand Identity)</h2>
            <p className="crm-settings-subtitle">
              Parameter berikut menjadi acuan fundamental bagi AI saat men-generate caption, hook, visual aset, dan riset ide konten otomatis.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="crm-settings-loading">
          <Loader2 className="spin" size={24} />
          <span>Memuat data identitas brand...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="crm-settings-form-body">
          {/* SECTION 1: PROFIL UMUM */}
          <div className="crm-form-section">
            <h3 className="crm-form-section-title">1. Profil Utama Brand</h3>
            <div className="crm-form-grid-2">
              <div className="crm-form-group">
                <label className="crm-label">Nama Resmi Brand / Bisnis *</label>
                <input
                  type="text"
                  className="crm-input"
                  value={profile.businessName}
                  onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                  placeholder="Contoh: Routie CRM"
                  required
                />
              </div>

              <div className="crm-form-group">
                <label className="crm-label">Niche / Kategori Industri</label>
                <select
                  className="crm-select"
                  value={profile.niche}
                  onChange={(e) => setProfile({ ...profile, niche: e.target.value })}
                >
                  {NICHE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="crm-form-grid-2">
              <div className="crm-form-group">
                <label className="crm-label">Tagline Brand</label>
                <input
                  type="text"
                  className="crm-input"
                  value={profile.tagline}
                  onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                  placeholder="Slogan atau value proposition singkat"
                />
              </div>

              <div className="crm-form-group">
                <label className="crm-label">Website / Landing Page URL</label>
                <input
                  type="url"
                  className="crm-input"
                  value={profile.websiteUrl}
                  onChange={(e) => setProfile({ ...profile, websiteUrl: e.target.value })}
                  placeholder="https://brandanda.com"
                />
              </div>
            </div>

            <div className="crm-form-group">
              <label className="crm-label">Deskripsi Singkat & Value Brand (Brief)</label>
              <textarea
                className="crm-textarea"
                rows={3}
                value={profile.brief}
                onChange={(e) => setProfile({ ...profile, brief: e.target.value })}
                placeholder="Jelaskan produk, solusi, atau keunggulan utama brand Anda..."
              />
            </div>
          </div>

          {/* SECTION 2: TARGET PASAR & AUDIENS */}
          <div className="crm-form-section">
            <h3 className="crm-form-section-title">2. Target Audiens & Demografi</h3>
            <div className="crm-form-group">
              <label className="crm-label">Deskripsi Target Pasar</label>
              <input
                type="text"
                className="crm-input"
                value={profile.targetAudience}
                onChange={(e) => setProfile({ ...profile, targetAudience: e.target.value })}
                placeholder="Siapa target pelanggan ideal Anda? (karakter, profesi, minat)"
              />
            </div>

            <div className="crm-form-grid-3">
              <div className="crm-form-group">
                <label className="crm-label">Rentang Usia Minimal</label>
                <input
                  type="number"
                  min={13}
                  max={100}
                  className="crm-input"
                  value={profile.targetAgeMin}
                  onChange={(e) => setProfile({ ...profile, targetAgeMin: Number(e.target.value) })}
                />
              </div>

              <div className="crm-form-group">
                <label className="crm-label">Rentang Usia Maksimal</label>
                <input
                  type="number"
                  min={13}
                  max={100}
                  className="crm-input"
                  value={profile.targetAgeMax}
                  onChange={(e) => setProfile({ ...profile, targetAgeMax: Number(e.target.value) })}
                />
              </div>

              <div className="crm-form-group">
                <label className="crm-label">Target Gender</label>
                <select
                  className="crm-select"
                  value={profile.targetGender}
                  onChange={(e) => setProfile({ ...profile, targetGender: e.target.value })}
                >
                  <option value="ALL">Semua Gender (Laki-laki & Perempuan)</option>
                  <option value="FEMALE">Utamanya Perempuan</option>
                  <option value="MALE">Utamanya Laki-laki</option>
                </select>
              </div>
            </div>

            {/* Target Locations Tags */}
            <div className="crm-form-group">
              <label className="crm-label">Target Wilayah / Kota Utama</label>
              <div className="crm-tags-wrap">
                {profile.targetLocations.map((loc) => (
                  <span key={loc} className="crm-tag-pill">
                    {loc}
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, targetLocations: profile.targetLocations.filter((l) => l !== loc) })}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="crm-tag-input-row">
                <input
                  type="text"
                  className="crm-input"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Ketik nama kota / negara lalu klik Tambah"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newLocation.trim()) {
                        setProfile({ ...profile, targetLocations: [...profile.targetLocations, newLocation.trim()] });
                        setNewLocation("");
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  onClick={() => {
                    if (newLocation.trim()) {
                      setProfile({ ...profile, targetLocations: [...profile.targetLocations, newLocation.trim()] });
                      setNewLocation("");
                    }
                  }}
                >
                  <Plus size={14} /> Tambah
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: VOICE, TONE & AI PERSONA */}
          <div className="crm-form-section">
            <div className="crm-form-section-header">
              <h3 className="crm-form-section-title">3. Voice, Tone & Persona AI</h3>
              <span className="crm-badge green">
                <Sparkles size={12} /> Prompt Guidance
              </span>
            </div>

            <div className="crm-form-group">
              <label className="crm-label">Gaya Bahasa (Tone of Voice)</label>
              <div className="crm-tone-presets-grid">
                {TONE_PRESETS.map((t) => (
                  <div
                    key={t.label}
                    className={`crm-tone-preset-card ${profile.tone === t.label ? "active" : ""}`}
                    onClick={() => setProfile({ ...profile, tone: t.label })}
                  >
                    <div className="crm-tone-card-top">
                      <b>{t.label}</b>
                      {profile.tone === t.label && <Check size={14} className="text-green" />}
                    </div>
                    <span>{t.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="crm-form-group">
              <label className="crm-label">Karakter / Persona AI (System Prompt Persona)</label>
              <textarea
                className="crm-textarea"
                rows={3}
                value={profile.brandPersona}
                onChange={(e) => setProfile({ ...profile, brandPersona: e.target.value })}
                placeholder="Instruksi khusus gaya bahasa AI, misalnya: 'Gunakan kata ganti Kita/Kalian, hindari bahasa baku kaku, selipkan emoji yang relevan...'"
              />
            </div>
          </div>

          {/* SECTION 4: COLOR PALETTE */}
          <div className="crm-form-section">
            <h3 className="crm-form-section-title">4. Palet Warna Visual Brand</h3>
            <p className="crm-form-section-subtitle">
              Warna-warna ini digunakan otomatis oleh generator gambar/template untuk konsistensi branding.
            </p>
            <div className="crm-color-palette-grid">
              {profile.colors.map((color, idx) => (
                <div key={idx} className="crm-color-chip">
                  <div className="crm-color-dot" style={{ backgroundColor: color }} />
                  <span className="crm-color-hex">{color}</span>
                  <button
                    type="button"
                    className="crm-color-remove-btn"
                    onClick={() => setProfile({ ...profile, colors: profile.colors.filter((_, i) => i !== idx) })}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="crm-color-add-row">
              <input
                type="color"
                className="crm-color-picker-input"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
              />
              <input
                type="text"
                className="crm-input"
                style={{ width: "120px" }}
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
              />
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => {
                  if (/^#[0-9a-fA-F]{6}$/.test(newColor) && !profile.colors.includes(newColor)) {
                    setProfile({ ...profile, colors: [...profile.colors, newColor] });
                  }
                }}
              >
                <Plus size={14} /> Tambah Warna
              </button>
            </div>
          </div>

          {/* SECTION 5: CONTENT PILLARS */}
          <div className="crm-form-section">
            <div className="crm-form-section-header">
              <div>
                <h3 className="crm-form-section-title">5. Alokasi Pilar Konten (Content Pillars)</h3>
                <p className="crm-form-section-subtitle">
                  AI akan mendistribusikan ide postingan bulanan sesuai persentase pilar ini. Total harus 100%.
                </p>
              </div>
              <span className={`crm-badge ${totalPillarPercentage === 100 ? "green" : "red"}`}>
                Total: {totalPillarPercentage}% / 100%
              </span>
            </div>

            <div className="crm-pillars-list">
              {profile.contentPillars.map((pillar, idx) => (
                <div key={idx} className="crm-pillar-edit-row">
                  <input
                    type="text"
                    className="crm-input"
                    style={{ flex: 3 }}
                    value={pillar.name}
                    onChange={(e) => handlePillarChange(idx, "name", e.target.value)}
                    placeholder="Nama Pilar"
                    required
                  />
                  <div className="crm-pillar-slider-wrap" style={{ flex: 2 }}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      className="crm-range-input"
                      value={pillar.percentage}
                      onChange={(e) => handlePillarChange(idx, "percentage", e.target.value)}
                    />
                    <span className="crm-pillar-pct-badge">{pillar.percentage}%</span>
                  </div>
                  {profile.contentPillars.length > 1 && (
                    <button
                      type="button"
                      className="crm-icon-btn text-red"
                      onClick={() => removePillar(idx)}
                      title="Hapus Pilar"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              onClick={addPillar}
              style={{ marginTop: "10px" }}
            >
              <Plus size={14} /> Tambah Pilar Konten
            </button>
          </div>

          {/* SECTION 6: GUARDRAILS & CTAS */}
          <div className="crm-form-section">
            <h3 className="crm-form-section-title">6. Batasan Klaim & CTA Favorit</h3>

            {/* Prohibited claims */}
            <div className="crm-form-group">
              <label className="crm-label">Klaim yang DILARANG Digunakan AI (Prohibited Claims)</label>
              <div className="crm-tags-wrap">
                {profile.prohibitedClaims.map((claim, idx) => (
                  <span key={idx} className="crm-tag-pill red">
                    {claim}
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, prohibitedClaims: profile.prohibitedClaims.filter((_, i) => i !== idx) })}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="crm-tag-input-row">
                <input
                  type="text"
                  className="crm-input"
                  value={newClaim}
                  onChange={(e) => setNewClaim(e.target.value)}
                  placeholder="Ketik larangan klaim..."
                />
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  onClick={() => {
                    if (newClaim.trim()) {
                      setProfile({ ...profile, prohibitedClaims: [...profile.prohibitedClaims, newClaim.trim()] });
                      setNewClaim("");
                    }
                  }}
                >
                  <Plus size={14} /> Tambah
                </button>
              </div>
            </div>

            {/* Favorite CTAs */}
            <div className="crm-form-group">
              <label className="crm-label">Daftar Call-To-Action (CTA) Favorit Brand</label>
              <div className="crm-tags-wrap">
                {profile.callsToAction.map((cta, idx) => (
                  <span key={idx} className="crm-tag-pill blue">
                    {cta}
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, callsToAction: profile.callsToAction.filter((_, i) => i !== idx) })}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="crm-tag-input-row">
                <input
                  type="text"
                  className="crm-input"
                  value={newCta}
                  onChange={(e) => setNewCta(e.target.value)}
                  placeholder="Ketik kalimat CTA favorit..."
                />
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  onClick={() => {
                    if (newCta.trim()) {
                      setProfile({ ...profile, callsToAction: [...profile.callsToAction, newCta.trim()] });
                      setNewCta("");
                    }
                  }}
                >
                  <Plus size={14} /> Tambah
                </button>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="crm-form-footer-bar">
            {saveStatus && (
              <div className={`crm-status-toast-inline ${saveStatus.success ? "success" : "error"}`}>
                {saveStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{saveStatus.message}</span>
              </div>
            )}
            <button
              type="submit"
              className="crm-btn crm-btn-primary"
              disabled={saving}
            >
              {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
              <span>{saving ? "Menyimpan Identitas..." : "Simpan Identitas Brand"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
