"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  ImagePlus,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Palette,
  PlaySquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video
} from "lucide-react";

type MediaProvider = "OPENAI" | "GEMINI" | "ZARK";

type MediaAssetStatus = {
  isConfigured: boolean;
  provider: MediaProvider | null;
  model: string | null;
  secretLastFour: string | null;
  validatedAt: string | null;
};

type ZarkPilotStatus = {
  enabled: boolean;
  monthlyImageLimit: number;
  attemptsThisMonth: number;
  remainingThisMonth: number;
};

function providerName(provider: MediaProvider | null): string {
  if (provider === "OPENAI") return "OpenAI (GPT-Image)";
  if (provider === "GEMINI") return "Google Gemini (Imagen)";
  if (provider === "ZARK") return "Zark Auto";
  return "Provider gambar AI";
}

function providerDashboard(provider: MediaProvider): { label: string; url: string } {
  if (provider === "OPENAI") return { label: "OpenAI API Keys", url: "https://platform.openai.com/api-keys" };
  if (provider === "GEMINI") return { label: "Google AI Studio", url: "https://aistudio.google.com/app/apikey" };
  return { label: "Zark", url: "https://www.zarklab.ai/" };
}

function apiKeyDescription(provider: MediaProvider): string {
  if (provider === "OPENAI") return "OpenAI (berawalan sk-...)";
  if (provider === "GEMINI") return "Google AI (berawalan AIza...)";
  return "Zark dari akun Pro Anda";
}

export function MediaAssetSection() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MediaAssetStatus | null>(null);
  const [zarkPilot, setZarkPilot] = useState<ZarkPilotStatus>({
    enabled: false,
    monthlyImageLimit: 25,
    attemptsThisMonth: 0,
    remainingThisMonth: 25
  });
  const [isEditing, setIsEditing] = useState(false);
  const [provider, setProvider] = useState<MediaProvider>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch status on mount
  async function fetchStatus() {
    try {
      setLoading(true);
      const res = await fetch("/api/provider-credentials");
      if (res.ok) {
        const data = (await res.json()) as { mediaAsset?: MediaAssetStatus; zarkPilot?: ZarkPilotStatus };
        setStatus(
          data.mediaAsset || {
            isConfigured: false,
            provider: null,
            model: null,
            secretLastFour: null,
            validatedAt: null
          }
        );
        if (data.zarkPilot) setZarkPilot(data.zarkPilot);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  // Paste from clipboard helper
  async function handlePaste() {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setApiKey(text.trim());
          setTestResult(null);
          setSaveError(null);
        }
      }
    } catch {
      // Clipboard permission denied
    }
  }

  // Test connection
  async function handleTestConnection(keyToTest?: string) {
    const key = (keyToTest || apiKey).trim();
    if (!key && !status?.isConfigured) {
      setTestResult({
        success: false,
        message: "Silakan masukkan Kunci API terlebih dahulu sebelum menguji."
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    setSaveError(null);

    try {
      const payload = key
        ? { apiKey: key, provider }
        : { target: "MEDIA_ASSET" };

      const res = await fetch("/api/provider-credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as { success?: boolean; message?: string };

      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || `Koneksi ke ${providerName(provider)} berhasil!`
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || "Kunci API tidak valid atau ditolak oleh penyedia AI."
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Gagal menghubungi server untuk menguji koneksi."
      });
    } finally {
      setTesting(false);
    }
  }

  // Save key
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setSaveError("Silakan masukkan Kunci API.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/provider-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MEDIA_ASSET",
          provider,
          apiKey: cleanKey
        })
      });
      const data = (await res.json()) as { success?: boolean; message?: string };

      if (!res.ok) {
        throw new Error(data.message || "Gagal menyimpan kunci API.");
      }

      setIsEditing(false);
      setApiKey("");
      setTestResult(null);
      await fetchStatus();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  // Delete key
  async function handleDeleteKey() {
    setDeleting(true);
    try {
      const target = status?.provider === "ZARK" ? "zark-pilot" : "media";
      const res = await fetch(`/api/provider-credentials?target=${target}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setShowDeleteModal(false);
        setTestResult(null);
        await fetchStatus();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="crm-ai-loading-card">
        <Loader2 className="spin" size={24} />
        <span>Memuat status generasi aset media...</span>
      </div>
    );
  }

  // Connected View
  if (status?.isConfigured && !isEditing) {
    return (
      <div className="crm-ai-connected-container">
        <div className="crm-ai-connected-card">
          <div className="crm-ai-connected-header">
            <div className="crm-ai-connected-info">
              <div className="crm-ai-logo-box" style={{ background: "#FDF2F8", borderColor: "#FBCFE8", color: "#DB2777" }}>
                <ImagePlus size={20} />
              </div>
              <div>
                <div className="crm-ai-title-row">
                  <h3 className="crm-ai-main-title">
                    {providerName(status.provider)}
                  </h3>
                  <span className="crm-badge green">
                    <span className="crm-badge-dot green" />
                    <span>Terhubung & Aktif</span>
                  </span>
                </div>
                <p className="crm-ai-subtitle">
                  {status.provider === "ZARK"
                    ? "Zark Pilot aktif untuk evaluasi text-to-image. Hasil yang selesai langsung disimpan ke storage Routie."
                    : "Kunci API aktif untuk membuat gambar postingan feed, banner grafis, dan aset story otomatis."}
                </p>
              </div>
            </div>
          </div>

          <div className="crm-ai-details-grid">
            <div className="crm-ai-detail-item">
              <span className="crm-ai-detail-label">Kunci API Terpasang</span>
              <div className="crm-ai-key-display">
                <Lock size={13} />
                <code>•••• •••• •••• {status.secretLastFour || "••••"}</code>
              </div>
            </div>

            <div className="crm-ai-detail-item">
              <span className="crm-ai-detail-label">Model Gambar AI</span>
              <span className="crm-ai-detail-value">
                {status.model || (status.provider === "OPENAI" ? "gpt-image-2" : status.provider === "ZARK" ? "auto" : "gemini-3.1-flash-image")}
              </span>
            </div>

            <div className="crm-ai-detail-item">
              <span className="crm-ai-detail-label">
                {status.provider === "ZARK" ? "Penggunaan Pilot Bulan Ini" : "Format Aset Didukung"}
              </span>
              {status.provider === "ZARK" ? (
                <span className="crm-ai-detail-value">
                  {zarkPilot.attemptsThisMonth} dari {zarkPilot.monthlyImageLimit} percobaan · {zarkPilot.remainingThisMonth} tersisa
                </span>
              ) : (
                <div className="crm-ai-tags-row">
                  <span className="crm-ai-tag">Feed Post (1:1)</span>
                  <span className="crm-ai-tag">Story (9:16)</span>
                  <span className="crm-ai-tag">Landscape (16:9)</span>
                </div>
              )}
            </div>

            <div className="crm-ai-detail-item">
              <span className="crm-ai-detail-label">Terakhir Divalidasi</span>
              <span className="crm-ai-detail-value">
                {status.validatedAt
                  ? new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    }).format(new Date(status.validatedAt))
                  : "Aktif"}
              </span>
            </div>
          </div>

          {testResult && (
            <div className={`crm-ai-alert-box ${testResult.success ? "success" : "error"}`}>
              {testResult.success ? (
                <CheckCircle2 size={16} className="crm-ai-alert-icon" />
              ) : (
                <AlertCircle size={16} className="crm-ai-alert-icon" />
              )}
              <div className="crm-ai-alert-content">
                <b className="crm-ai-alert-heading">
                  {testResult.success ? "Hasil Uji Koneksi: Berhasil" : "Hasil Uji Koneksi: Gagal"}
                </b>
                <p className="crm-ai-alert-desc">{testResult.message}</p>
              </div>
            </div>
          )}

          <div className="crm-ai-connected-actions">
            <button
              type="button"
              onClick={() => handleTestConnection()}
              disabled={testing}
              className="crm-btn crm-btn-secondary"
            >
              {testing ? (
                <>
                  <Loader2 className="spin" size={14} />
                  <span>Menguji...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  <span>Uji Koneksi</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setTestResult(null);
                setProvider(status.provider || "OPENAI");
              }}
              className="crm-btn crm-btn-secondary"
            >
              <Edit3 size={14} />
              <span>Ganti Kunci API</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="crm-btn crm-btn-danger"
            >
              <Trash2 size={14} />
              <span>{status.provider === "ZARK" ? "Hentikan Pilot" : "Hapus Kunci"}</span>
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="crm-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
            <div className="crm-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="crm-modal-header">
                <div className="crm-modal-title-row">
                  <AlertTriangle className="crm-warn-icon" size={20} />
                  <h3>{status.provider === "ZARK" ? "Hentikan Zark Pilot?" : "Hapus Kunci Generasi Aset Media?"}</h3>
                </div>
              </div>
              <div className="crm-modal-body">
                <p>
                  {status.provider === "ZARK"
                    ? "Kunci Zark akan dihapus dan provider gambar yang Anda gunakan sebelumnya akan diaktifkan kembali secara otomatis. Semua gambar yang sudah tersimpan di Routie tetap aman."
                    : "Setelah dihapus, draf konten tidak dapat di-generate menjadi gambar visual atau video hingga Anda menghubungkan kembali kunci API gambar."}
                </p>
              </div>
              <div className="crm-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="crm-btn crm-btn-secondary"
                  disabled={deleting}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteKey}
                  disabled={deleting}
                  className="crm-btn crm-btn-danger"
                >
                  {deleting ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                  <span>
                    {deleting ? "Memproses..." : status.provider === "ZARK" ? "Ya, Hentikan Pilot" : "Ya, Hapus Kunci"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Setup / Edit Form View
  return (
    <div className="crm-ai-setup-card">
      {/* Header Explanation */}
      <div className="crm-ai-setup-header" style={{ background: "linear-gradient(135deg, #FDF2F8 0%, #F8FAFC 100%)", borderColor: "#FBCFE8" }}>
        <div className="crm-ai-setup-icon-wrap" style={{ background: "#DB2777" }}>
          <ImagePlus className="crm-ai-setup-sparkle-icon" size={24} />
        </div>
        <div className="crm-ai-setup-header-text">
          <div className="crm-ai-title-row">
            <h3 className="crm-ai-setup-title">
              {isEditing ? "Perbarui Kunci Generasi Aset Media" : "Hubungkan Kunci AI untuk Aset Media Sosial"}
            </h3>
            <span className="crm-badge purple">
              <Palette size={11} />
              <span>Gambar & Video AI</span>
            </span>
          </div>
          <p className="crm-ai-setup-desc">
            Kunci API ini digunakan khusus untuk <b>membuat gambar feed Instagram berkualitas tinggi, banner promosi, dan aset cerita (Story)</b> secara otomatis sesuai dengan identitas brand Anda.
          </p>

          <div className="crm-ai-reassurance-row" style={{ borderColor: "#FBCFE8" }}>
            <div className="crm-ai-reassurance-item" style={{ borderColor: "#FBCFE8", color: "#9D174D" }}>
              <ImageIcon size={13} style={{ color: "#DB2777" }} />
              <span>Gambar Feed Instagram & Facebook</span>
            </div>
            <div className="crm-ai-reassurance-item" style={{ borderColor: "#FBCFE8", color: "#9D174D" }}>
              <PlaySquare size={13} style={{ color: "#DB2777" }} />
              <span>Aset Story Vertikal (9:16)</span>
            </div>
            <div className="crm-ai-reassurance-item" style={{ borderColor: "#FBCFE8", color: "#9D174D" }}>
              <ShieldCheck size={13} style={{ color: "#DB2777" }} />
              <span>Terenkripsi Aman AES-256</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="crm-ai-steps-container">
        {/* Step 1: Choose AI Provider */}
        <div className="crm-ai-step-item">
          <div className="crm-ai-step-number" style={{ background: "#FDF2F8", color: "#DB2777", borderColor: "#FBCFE8" }}>1</div>
          <div className="crm-ai-step-content">
            <div className="crm-ai-step-header">
              <h4 className="crm-ai-step-title">Pilih Penyedia Gambar AI</h4>
            </div>
            <p className="crm-ai-step-instruction">
              Pilih provider yang ingin Anda gunakan untuk membuat aset visual:
            </p>

            <div className="crm-media-provider-grid">
              <label
                className={`crm-media-provider-card ${provider === "OPENAI" ? "selected" : ""}`}
                onClick={() => setProvider("OPENAI")}
              >
                <input
                  type="radio"
                  name="mediaProvider"
                  value="OPENAI"
                  checked={provider === "OPENAI"}
                  onChange={() => setProvider("OPENAI")}
                />
                <div className="crm-media-provider-body">
                  <div className="crm-media-provider-title-row">
                    <b>OpenAI (DALL·E / GPT-Image)</b>
                    <span className="crm-badge green" style={{ fontSize: "10px", padding: "1px 6px" }}>Direkomendasikan</span>
                  </div>
                  <span className="crm-media-provider-desc">
                    Sangat optimal untuk gambar artistik, ilustrasi konten, dan desain visual postingan.
                  </span>
                </div>
              </label>

              <label
                className={`crm-media-provider-card ${provider === "GEMINI" ? "selected" : ""}`}
                onClick={() => setProvider("GEMINI")}
              >
                <input
                  type="radio"
                  name="mediaProvider"
                  value="GEMINI"
                  checked={provider === "GEMINI"}
                  onChange={() => setProvider("GEMINI")}
                />
                <div className="crm-media-provider-body">
                  <div className="crm-media-provider-title-row">
                    <b>Google Gemini (Imagen)</b>
                  </div>
                  <span className="crm-media-provider-desc">
                    Generasi gambar cepat dan terintegrasi dalam ekosistem Google AI Studio.
                  </span>
                </div>
              </label>

              {zarkPilot.enabled && (
                <label
                  className={`crm-media-provider-card ${provider === "ZARK" ? "selected" : ""}`}
                  onClick={() => setProvider("ZARK")}
                >
                  <input
                    type="radio"
                    name="mediaProvider"
                    value="ZARK"
                    checked={provider === "ZARK"}
                    onChange={() => setProvider("ZARK")}
                  />
                  <div className="crm-media-provider-body">
                    <div className="crm-media-provider-title-row">
                      <b>Zark Auto</b>
                      <span className="crm-badge blue" style={{ fontSize: "10px", padding: "1px 6px" }}>
                        Pilot Development
                      </span>
                    </div>
                    <span className="crm-media-provider-desc">
                      Uji banyak model gambar lewat satu akun Zark. Image-only, 1 output per request, dan dapat dimatikan kapan saja.
                    </span>
                  </div>
                </label>
              )}
            </div>

            {provider === "ZARK" && (
              <div className="crm-zark-pilot-note">
                <Sparkles size={15} />
                <div>
                  <b>Zark Pilot aman untuk eksperimen</b>
                  <span>
                    Maksimal {zarkPilot.monthlyImageLimit} percobaan per workspace per bulan. Setiap generation tetap memakai kredit akun Zark Anda.
                  </span>
                </div>
              </div>
            )}

            <div style={{ marginTop: "10px" }}>
              <a
                href={providerDashboard(provider).url}
                target="_blank"
                rel="noopener noreferrer"
                className="crm-btn crm-btn-secondary crm-ai-external-btn"
                style={{ fontSize: "12px" }}
              >
                <span>Buka Dashboard {providerDashboard(provider).label}</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>

        {/* Step 2: Paste API Key & Test */}
        <div className="crm-ai-step-item">
          <div className="crm-ai-step-number" style={{ background: "#FDF2F8", color: "#DB2777", borderColor: "#FBCFE8" }}>2</div>
          <div className="crm-ai-step-content">
            <h4 className="crm-ai-step-title">Tempelkan Kunci API</h4>
            <p className="crm-ai-step-instruction">
              Masukkan kunci API {apiKeyDescription(provider)} ke kolom di bawah ini:
            </p>

            <div className="crm-ai-input-wrapper">
              <KeyRound className="crm-ai-input-icon" size={16} />
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                  setSaveError(null);
                }}
                placeholder={
                  provider === "OPENAI"
                    ? "Contoh: sk-proj-1234567890abcdef..."
                    : provider === "GEMINI"
                      ? "Contoh: AIzaSyA1b2c3d4e5..."
                      : "Tempel API key Zark Anda..."
                }
                className="crm-input crm-ai-input"
                autoComplete="off"
                spellCheck="false"
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="crm-ai-icon-btn"
                title={showKey ? "Sembunyikan kunci" : "Tampilkan kunci"}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={handlePaste}
                className="crm-ai-paste-btn"
                title="Tempel dari Clipboard"
              >
                <Clipboard size={14} />
                <span>Tempel</span>
              </button>
            </div>

            <div className="crm-ai-security-hint" style={{ marginTop: "8px" }}>
              <Lock size={13} />
              <span>
                Kunci Anda disimpan dengan enkripsi AES-256 dan hanya digunakan saat Anda mengklik tombol &quot;Generate Gambar&quot;.
              </span>
            </div>

            {testResult && (
              <div className={`crm-ai-alert-box ${testResult.success ? "success" : "error"}`}>
                {testResult.success ? (
                  <CheckCircle2 size={16} className="crm-ai-alert-icon" />
                ) : (
                  <AlertCircle size={16} className="crm-ai-alert-icon" />
                )}
                <div className="crm-ai-alert-content">
                  <b className="crm-ai-alert-heading">
                    {testResult.success ? "Koneksi Berhasil!" : "Gagal Terhubung"}
                  </b>
                  <p className="crm-ai-alert-desc">{testResult.message}</p>
                </div>
              </div>
            )}

            {saveError && (
              <div className="crm-ai-alert-box error">
                <AlertCircle size={16} className="crm-ai-alert-icon" />
                <div className="crm-ai-alert-content">
                  <b className="crm-ai-alert-heading">Terjadi Kendala</b>
                  <p className="crm-ai-alert-desc">{saveError}</p>
                </div>
              </div>
            )}

            <div className="crm-ai-action-buttons">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="crm-btn crm-btn-secondary"
                  disabled={testing || saving}
                >
                  Batal
                </button>
              )}

              <button
                type="button"
                onClick={() => handleTestConnection(apiKey)}
                disabled={testing || saving || !apiKey.trim()}
                className="crm-btn crm-btn-secondary crm-ai-test-btn"
              >
                {testing ? (
                  <>
                    <Loader2 className="spin" size={15} />
                    <span>Menguji Koneksi...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} />
                    <span>Uji Koneksi</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={saving || testing || !apiKey.trim()}
                className="crm-btn crm-btn-primary crm-ai-save-btn"
                style={{ background: "#DB2777" }}
              >
                {saving ? (
                  <>
                    <Loader2 className="spin" size={15} />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} />
                    <span>{isEditing ? "Simpan Perubahan" : "Simpan & Hubungkan"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
