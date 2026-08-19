"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  Loader2,
  Mail,
  Save,
  Send,
  Sparkles,
  TrendingUp
} from "lucide-react";

interface NotificationPreferences {
  approvalRequired: boolean;
  publishFailed: boolean;
  tokenExpired: boolean;
  weeklyDigest: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
}

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    approvalRequired: true,
    publishFailed: true,
    tokenExpired: true,
    weeklyDigest: true,
    emailNotifications: true,
    inAppNotifications: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/notifications/preferences");
        if (res.ok) {
          const data = await res.json();
          if (data.preferences) {
            setPrefs(data.preferences);
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
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs)
      });
      if (res.ok) {
        setStatusMessage({ success: true, text: "Preferensi notifikasi berhasil diperbarui." });
      } else {
        const data = await res.json();
        setStatusMessage({ success: false, text: data.message || "Gagal menyimpan preferensi." });
      }
    } catch {
      setStatusMessage({ success: false, text: "Kesalahan jaringan saat menyimpan preferensi." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="crm-settings-card">
      <div className="crm-settings-card-header">
        <div className="crm-settings-title-group">
          <div className="crm-settings-icon-badge blue">
            <Bell size={18} />
          </div>
          <div>
            <h2 className="crm-settings-title">Preferensi Notifikasi & Peringatan</h2>
            <p className="crm-settings-subtitle">
              Atur bagaimana dan kapan Anda menerima notifikasi penting terkait jadwal rilis, status review, dan kesehatan integrasi akun.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="crm-settings-loading">
          <Loader2 className="spin" size={24} />
          <span>Memuat preferensi notifikasi...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="crm-settings-form-body">
          {/* Section 1: Event-based Notifications */}
          <div className="crm-form-section">
            <h3 className="crm-form-section-title">1. Pemicu Notifikasi Konten</h3>
            
            <div className="crm-toggle-item">
              <div className="crm-toggle-meta">
                <div className="crm-toggle-icon-box amber">
                  <FileCheck2 size={16} />
                </div>
                <div>
                  <b className="crm-toggle-title">Konsep Memerlukan Review (Approval Required)</b>
                  <p className="crm-toggle-desc">
                    Kirim notifikasi saat AI selesai men-generate konsep baru atau draf siap untuk tahap Final Review.
                  </p>
                </div>
              </div>
              <label className="crm-switch">
                <input
                  type="checkbox"
                  checked={prefs.approvalRequired}
                  onChange={(e) => setPrefs({ ...prefs, approvalRequired: e.target.checked })}
                />
                <span className="crm-slider" />
              </label>
            </div>

            <div className="crm-toggle-item">
              <div className="crm-toggle-meta">
                <div className="crm-toggle-icon-box red">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <b className="crm-toggle-title">Penerbitan Konten Gagal (Publish Failed)</b>
                  <p className="crm-toggle-desc">
                    Dapatkan peringatan segera jika terjadi kendala teknis saat memposting ke Instagram, Facebook, atau TikTok.
                  </p>
                </div>
              </div>
              <label className="crm-switch">
                <input
                  type="checkbox"
                  checked={prefs.publishFailed}
                  onChange={(e) => setPrefs({ ...prefs, publishFailed: e.target.checked })}
                />
                <span className="crm-slider" />
              </label>
            </div>

            <div className="crm-toggle-item">
              <div className="crm-toggle-meta">
                <div className="crm-toggle-icon-box purple">
                  <KeyRound size={16} />
                </div>
                <div>
                  <b className="crm-toggle-title">Peringatan Kunci API / Token Kedaluwarsa</b>
                  <p className="crm-toggle-desc">
                    Notifikasi ketika token OAuth sosial media atau API key Google AI Studio Anda mendekati tanggal kedaluwarsa.
                  </p>
                </div>
              </div>
              <label className="crm-switch">
                <input
                  type="checkbox"
                  checked={prefs.tokenExpired}
                  onChange={(e) => setPrefs({ ...prefs, tokenExpired: e.target.checked })}
                />
                <span className="crm-slider" />
              </label>
            </div>

            <div className="crm-toggle-item">
              <div className="crm-toggle-meta">
                <div className="crm-toggle-icon-box green">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <b className="crm-toggle-title">Ringkasan Kinerja Mingguan (Weekly Digest)</b>
                  <p className="crm-toggle-desc">
                    Laporan rangkuman performa engagement, reach, dan postingan terbaik yang terbit dalam 7 hari terakhir.
                  </p>
                </div>
              </div>
              <label className="crm-switch">
                <input
                  type="checkbox"
                  checked={prefs.weeklyDigest}
                  onChange={(e) => setPrefs({ ...prefs, weeklyDigest: e.target.checked })}
                />
                <span className="crm-slider" />
              </label>
            </div>
          </div>

          {/* Section 2: Delivery Channels */}
          <div className="crm-form-section">
            <h3 className="crm-form-section-title">2. Saluran Pengiriman Notifikasi</h3>

            <div className="crm-toggle-item">
              <div className="crm-toggle-meta">
                <div className="crm-toggle-icon-box blue">
                  <Mail size={16} />
                </div>
                <div>
                  <b className="crm-toggle-title">Notifikasi Email</b>
                  <p className="crm-toggle-desc">
                    Kirimkan update kritis dan pengingat langsung ke alamat email terdaftar akun Anda.
                  </p>
                </div>
              </div>
              <label className="crm-switch">
                <input
                  type="checkbox"
                  checked={prefs.emailNotifications}
                  onChange={(e) => setPrefs({ ...prefs, emailNotifications: e.target.checked })}
                />
                <span className="crm-slider" />
              </label>
            </div>

            <div className="crm-toggle-item">
              <div className="crm-toggle-meta">
                <div className="crm-toggle-icon-box green">
                  <Bell size={16} />
                </div>
                <div>
                  <b className="crm-toggle-title">Notifikasi Dalam Aplikasi (In-App Bell)</b>
                  <p className="crm-toggle-desc">
                    Tampilkan badge merah dan daftar notifikasi di lonceng header dashboard.
                  </p>
                </div>
              </div>
              <label className="crm-switch">
                <input
                  type="checkbox"
                  checked={prefs.inAppNotifications}
                  onChange={(e) => setPrefs({ ...prefs, inAppNotifications: e.target.checked })}
                />
                <span className="crm-slider" />
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="crm-form-footer-bar">
            {statusMessage && (
              <div className={`crm-status-toast-inline ${statusMessage.success ? "success" : "error"}`}>
                {statusMessage.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{statusMessage.text}</span>
              </div>
            )}
            <button
              type="submit"
              className="crm-btn crm-btn-primary"
              disabled={saving}
            >
              {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
              <span>{saving ? "Menyimpan..." : "Simpan Preferensi"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
