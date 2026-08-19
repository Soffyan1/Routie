"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles
} from "lucide-react";

type SetupGuideProps = {
  onSuccess?: (() => void) | undefined;
  initialKey?: string | undefined;
  isEditMode?: boolean | undefined;
  onCancel?: (() => void) | undefined;
};

export function GoogleAISetupGuide({
  onSuccess,
  initialKey = "",
  isEditMode = false,
  onCancel
}: SetupGuideProps) {
  const [apiKey, setApiKey] = useState(initialKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

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
      // Clipboard permission denied, ignore
    }
  }

  // Test connection directly without saving
  async function handleTestConnection() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
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
      const response = await fetch("/api/provider-credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed, provider: "GEMINI" })
      });
      const data = (await response.json()) as { success?: boolean; message?: string };

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || "Koneksi berhasil! Kunci API Google AI Studio aktif dan valid."
        });
      } else {
        setTestResult({
          success: false,
          message:
            data.message ||
            "Kunci API tidak valid atau ditolak oleh Google. Pastikan seluruh karakter disalin dengan benar."
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Gagal menghubungi server untuk menguji koneksi. Periksa koneksi internet Anda."
      });
    } finally {
      setTesting(false);
    }
  }

  // Save and connect
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setSaveError("Silakan masukkan Kunci API Google AI Studio.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/provider-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed, provider: "GEMINI" })
      });
      const data = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok) {
        throw new Error(
          data.message || "Gagal menyimpan kunci API. Pastikan kunci disalin dengan benar."
        );
      }

      setSaveSuccess(true);
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1200);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="crm-ai-setup-card">
      {/* Header Explanation */}
      <div className="crm-ai-setup-header">
        <div className="crm-ai-setup-icon-wrap">
          <Sparkles className="crm-ai-setup-sparkle-icon" size={24} />
        </div>
        <div className="crm-ai-setup-header-text">
          <div className="crm-ai-title-row">
            <h3 className="crm-ai-setup-title">
              {isEditMode ? "Perbarui Kunci Google AI Studio" : "Hubungkan Google AI Studio (Riset Tren & Konten Viral)"}
            </h3>
            <span className="crm-badge green">
              <Sparkles size={11} />
              <span>100% Gratis (Free Tier)</span>
            </span>
          </div>
          <p className="crm-ai-setup-desc">
            Routie menggunakan kecerdasan buatan <b>Google Gemini</b> untuk <b>meriset ide konten yang menarik, viral, dan berbobot secara realtime</b> langsung dari tren Google Search terkini, serta menyusun kalender postingan otomatis. Penggunaan API Key akun Google pribadi Anda <b>100% Gratis</b>, tanpa kartu kredit, dan privasi data terjamin.
          </p>

          <div className="crm-ai-reassurance-row">
            <div className="crm-ai-reassurance-item">
              <Sparkles size={13} />
              <span>Riset Tren Viral & Aktual Realtime</span>
            </div>
            <div className="crm-ai-reassurance-item">
              <Sparkles size={13} />
              <span>Free Tier Harian Resmi Google</span>
            </div>
            <div className="crm-ai-reassurance-item">
              <Lock size={13} />
              <span>Tanpa Perlu Kartu Kredit</span>
            </div>
            <div className="crm-ai-reassurance-item">
              <ShieldCheck size={13} />
              <span>Enkripsi Aman AES-256</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step by Step Flow */}
      <div className="crm-ai-steps-container">
        {/* Step 1: Open Google AI Studio */}
        <div className="crm-ai-step-item">
          <div className="crm-ai-step-number">1</div>
          <div className="crm-ai-step-content">
            <div className="crm-ai-step-header">
              <h4 className="crm-ai-step-title">Buka Google AI Studio</h4>
              <span className="crm-ai-step-tag free">100% Gratis & Tanpa Biaya</span>
            </div>
            <p className="crm-ai-step-instruction">
              Masuk dengan akun Google Anda di portal Google AI Studio untuk membuat kunci akses gratis (digunakan untuk meriset topik viral dan tren Google Search secara realtime).
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="crm-btn crm-btn-secondary crm-ai-external-btn"
            >
              <span>Buka Google AI Studio</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Step 2: Visual Guidance */}
        <div className="crm-ai-step-item">
          <div className="crm-ai-step-number">2</div>
          <div className="crm-ai-step-content">
            <h4 className="crm-ai-step-title">Buat & Salin Kunci API Anda</h4>
            <p className="crm-ai-step-instruction">
              Ikuti 3 langkah cepat ini di layar Google AI Studio:
            </p>
            <div className="crm-ai-substeps-list">
              <div className="crm-ai-substep">
                <span className="crm-ai-substep-bullet">A</span>
                <span>Klik tombol biru <b>&quot;Create API key&quot;</b> (Buat Kunci API).</span>
              </div>
              <div className="crm-ai-substep">
                <span className="crm-ai-substep-bullet">B</span>
                <span>Pilih project Google Cloud Anda, lalu klik <b>&quot;Create key&quot;</b>.</span>
              </div>
              <div className="crm-ai-substep">
                <span className="crm-ai-substep-bullet">C</span>
                <span>
                  Klik tombol <b>&quot;Copy&quot;</b> untuk menyalin kunci (teks berawalan <code>AIza...</code>).
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Paste & Verify Input */}
        <div className="crm-ai-step-item">
          <div className="crm-ai-step-number">3</div>
          <div className="crm-ai-step-content">
            <h4 className="crm-ai-step-title">Tempelkan Kunci API ke Routie</h4>
            <p className="crm-ai-step-instruction">
              Masukkan kunci yang telah Anda salin ke kolom di bawah ini:
            </p>

            <form onSubmit={handleSave} className="crm-ai-input-form">
              <div className="crm-ai-input-group">
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
                    placeholder="Contoh: AIzaSyA1b2c3d4e5..."
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
              </div>

              {/* Security info note */}
              <div className="crm-ai-security-hint">
                <Lock size={13} />
                <span>
                  Kunci Anda disimpan secara aman dengan enkripsi AES-256 dan hanya digunakan untuk
                  membuat konten Anda.
                </span>
              </div>

              {/* Test Result Message */}
              {testResult && (
                <div
                  className={`crm-ai-alert-box ${
                    testResult.success ? "success" : "error"
                  }`}
                >
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
                    {!testResult.success && (
                      <div className="crm-ai-troubleshoot-tips">
                        <span>Tips pemecahan masalah:</span>
                        <ul>
                          <li>Pastikan seluruh teks kunci tersalin lengkap (dimulai dari <code>AIza...</code>).</li>
                          <li>Pastikan tidak ada spasi tambahan di awal atau akhir kunci.</li>
                          <li>Pastikan akun Google Anda tidak membatasi akses API.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Save Error */}
              {saveError && (
                <div className="crm-ai-alert-box error">
                  <AlertCircle size={16} className="crm-ai-alert-icon" />
                  <div className="crm-ai-alert-content">
                    <b className="crm-ai-alert-heading">Terjadi Kendala</b>
                    <p className="crm-ai-alert-desc">{saveError}</p>
                  </div>
                </div>
              )}

              {/* Save Success */}
              {saveSuccess && (
                <div className="crm-ai-alert-box success">
                  <CheckCircle2 size={16} className="crm-ai-alert-icon" />
                  <div className="crm-ai-alert-content">
                    <b className="crm-ai-alert-heading">Koneksi Berhasil Diaktifkan!</b>
                    <p className="crm-ai-alert-desc">
                      Google AI Studio kini terhubung dan siap digunakan untuk membuat kalender dan
                      ide konten.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="crm-ai-action-buttons">
                {isEditMode && onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="crm-btn crm-btn-secondary"
                    disabled={testing || saving}
                  >
                    Batal
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTestConnection}
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
                >
                  {saving ? (
                    <>
                      <Loader2 className="spin" size={15} />
                      <span>Menyimpan & Menghubungkan...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} />
                      <span>{isEditMode ? "Simpan Perubahan" : "Simpan & Hubungkan"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
