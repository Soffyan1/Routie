"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Globe2,
  HardDrive,
  Layers,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
  Sparkles
} from "lucide-react";

interface WorkspaceData {
  id: string;
  name: string;
  timezone: string;
  language: string;
  maxConceptsPerDay: number;
  maxMembers: number;
  maxStorageBytes: number;
  storageUsedBytes: number;
}

const TIMEZONES = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta (UTC+07:00)" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar (UTC+08:00)" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura (UTC+09:00)" },
  { value: "Asia/Singapore", label: "SGT — Asia/Singapore (UTC+08:00)" },
  { value: "UTC", label: "UTC — Universal Coordinated Time" }
];

const LANGUAGES = [
  { value: "id-ID", label: "Bahasa Indonesia (ID)" },
  { value: "en-US", label: "English (US)" }
];

export default function WorkspacePreferencesPage() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [language, setLanguage] = useState("id-ID");
  const [maxConcepts, setMaxConcepts] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/workspace");
        if (res.ok) {
          const data = await res.json();
          if (data.workspace) {
            setWorkspace(data.workspace);
            setName(data.workspace.name || "");
            setTimezone(data.workspace.timezone || "Asia/Jakarta");
            setLanguage(data.workspace.language || "id-ID");
            setMaxConcepts(data.workspace.maxConceptsPerDay || 3);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setStatusMessage(null);
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          timezone,
          language,
          maxConceptsPerDay: maxConcepts
        })
      });
      if (res.ok) {
        setStatusMessage({ success: true, text: "Pengaturan workspace berhasil diperbarui." });
      } else {
        const data = await res.json();
        setStatusMessage({ success: false, text: data.message || "Gagal memperbarui workspace." });
      }
    } catch {
      setStatusMessage({ success: false, text: "Kesalahan jaringan saat menyimpan pengaturan." });
    } finally {
      setSaving(false);
    }
  }

  function handleCopyId() {
    if (!workspace?.id) return;
    navigator.clipboard.writeText(workspace.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  const storageUsedGB = workspace ? ((workspace.storageUsedBytes || 0) / 1024 ** 3).toFixed(2) : "0.00";
  const storageMaxGB = workspace ? ((workspace.maxStorageBytes || 20 * 1024 ** 3) / 1024 ** 3).toFixed(0) : "20";
  const storagePercent = workspace && workspace.maxStorageBytes ? Math.min(100, Math.round(((workspace.storageUsedBytes || 0) / workspace.maxStorageBytes) * 100)) : 0;

  return (
    <div className="crm-settings-vertical-stack">
      {/* Toast Alert */}
      {statusMessage && (
        <div className={`crm-status-toast-row ${statusMessage.success ? "success" : "error"}`}>
          {statusMessage.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main General Preferences Card */}
      <div className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge blue">
              <Globe2 size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Preferensi Umum Workspace</h2>
              <p className="crm-settings-subtitle">
                Atur informasi dasar workspace, penyesuaian zona waktu jadwal rilis, dan kuota konten otomatis.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="crm-settings-loading">
            <Loader2 className="spin" size={24} />
            <span>Memuat pengaturan workspace...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="crm-settings-form-body">
            <div className="crm-form-section">
              <div className="crm-form-grid-2">
                <div className="crm-form-group">
                  <label className="crm-label">Nama Workspace</label>
                  <input
                    type="text"
                    className="crm-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="crm-form-group">
                  <label className="crm-label">Workspace ID (Unique Identifier)</label>
                  <div className="crm-input-with-action">
                    <input
                      type="text"
                      className="crm-input disabled"
                      value={workspace?.id || ""}
                      readOnly
                    />
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary"
                      onClick={handleCopyId}
                      title="Salin ID"
                    >
                      {copiedId ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                      <span>{copiedId ? "Tersalin" : "Salin"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="crm-form-grid-2">
                <div className="crm-form-group">
                  <label className="crm-label">Zona Waktu (Timezone) Publikasi</label>
                  <select
                    className="crm-select"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <span className="crm-input-hint">Waktu posting kalender akan selalu disesuaikan dengan zona waktu ini.</span>
                </div>

                <div className="crm-form-group">
                  <label className="crm-label">Bahasa Antarmuka Default</label>
                  <select
                    className="crm-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>{lang.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="crm-form-group">
                <label className="crm-label">Batas Generasi Konsep Harian AI (Maksimal per Hari)</label>
                <div className="crm-form-range-wrap">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    className="crm-range-input"
                    value={maxConcepts}
                    onChange={(e) => setMaxConcepts(Number(e.target.value))}
                  />
                  <span className="crm-badge blue">{maxConcepts} Slot Konsep / Hari</span>
                </div>
                <span className="crm-input-hint">Rekomendasi terbaik untuk konsistensi posting harian adalah 1 - 3 konten per hari.</span>
              </div>
            </div>

            {/* Form Actions */}
            <div className="crm-form-footer-bar">
              <button
                type="submit"
                className="crm-btn crm-btn-primary"
                disabled={saving}
              >
                {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                <span>{saving ? "Menyimpan..." : "Simpan Pengaturan Workspace"}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Storage & Entitlement Meter */}
      <div className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge purple">
              <HardDrive size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Kapasitas Penyimpanan Cloud Media</h2>
              <p className="crm-settings-subtitle">
                Alokasi kapasitas penyimpanan file gambar, video, dan thumbnail aset konten di workspace Anda.
              </p>
            </div>
          </div>
          <span className="crm-badge green">
            <ShieldCheck size={12} /> Cloud S3 Storage
          </span>
        </div>

        <div className="crm-settings-card-content">
          <div className="crm-storage-meter-box">
            <div className="crm-storage-meter-header">
              <span>Penggunaan Ruang Media</span>
              <b>{storageUsedGB} GB dari {storageMaxGB} GB ({storagePercent}%)</b>
            </div>
            <div className="crm-progress-track">
              <div
                className="crm-progress-fill"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <span className="crm-input-hint" style={{ marginTop: "8px", display: "block" }}>
              Aset visual yang sudah terbit di sosial media tetap disimpan dengan aman di cloud storage workspace Anda.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
