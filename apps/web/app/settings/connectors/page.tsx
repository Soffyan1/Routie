"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
  Unplug
} from "lucide-react";

interface ChannelConnection {
  id: "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "THREADS" | "YOUTUBE" | "X";
  name: string;
  initial: string;
  desc: string;
  defaultMode: string;
  supported: boolean;
  isConnected: boolean;
  accountName: string | null;
  deliveryMode: "AUTO_PUBLISH" | "PLATFORM_DRAFT" | "EXPORT_MANUAL";
  tokenExpiresAt: string | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
  connectedAt: string | null;
}

export default function ConnectorsPage() {
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

  async function fetchConnections() {
    try {
      setLoading(true);
      const res = await fetch("/api/social/connections");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConnections();
  }, []);

  async function handleToggle(channelId: string, isCurrentlyConnected: boolean) {
    try {
      setActionLoading(channelId);
      setStatusMessage(null);
      const action = isCurrentlyConnected ? "disconnect" : "connect";
      const res = await fetch("/api/social/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channelId, action })
      });
      if (res.ok) {
        setStatusMessage({
          success: true,
          text: isCurrentlyConnected
            ? `Koneksi ${channelId} berhasil diputus.`
            : `Akun ${channelId} berhasil dihubungkan.`
        });
        await fetchConnections();
      } else {
        const data = await res.json();
        setStatusMessage({ success: false, text: data.message || "Gagal mengubah status koneksi." });
      }
    } catch {
      setStatusMessage({ success: false, text: "Kesalahan jaringan saat menghubungi server." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleModeChange(channelId: string, newMode: "AUTO_PUBLISH" | "PLATFORM_DRAFT" | "EXPORT_MANUAL") {
    try {
      setActionLoading(channelId);
      setStatusMessage(null);
      const res = await fetch("/api/social/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channelId, action: "update_mode", deliveryMode: newMode })
      });
      if (res.ok) {
        setStatusMessage({ success: true, text: `Mode publikasi ${channelId} diperbarui ke ${newMode}.` });
        await fetchConnections();
      }
    } catch {
      setStatusMessage({ success: false, text: "Gagal memperbarui mode publikasi." });
    } finally {
      setActionLoading(null);
    }
  }

  const expiringChannels = channels.filter((c) => c.isConnected && (c.isExpiringSoon || c.isExpired));

  return (
    <div className="crm-settings-vertical-stack">
      {/* Toast Alert */}
      {statusMessage && (
        <div className={`crm-status-toast-row ${statusMessage.success ? "success" : "error"}`}>
          {statusMessage.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Warning Banner if token is expiring */}
      {expiringChannels.length > 0 && (
        <div className="crm-settings-alert-banner amber">
          <AlertTriangle size={18} />
          <div>
            <b>Peringatan Token Akses Kedaluwarsa!</b>
            <p>
              Terdapat {expiringChannels.length} channel yang memerlukan perpanjangan otentikasi (refresh token) agar jadwal posting otomatis tidak tertunda.
            </p>
          </div>
        </div>
      )}

      {/* Main Connectors Grid Card */}
      <section className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge purple">
              <PlugZap size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Koneksi Channel Sosial Media</h2>
              <p className="crm-settings-subtitle">
                Hubungkan akun resmi media sosial Anda untuk mengaktifkan direct auto-publishing, sync draft, dan analitik real-time.
              </p>
            </div>
          </div>
          <span className="crm-badge green">
            <ShieldCheck size={12} />
            <span>OAuth 2.0 Resmi</span>
          </span>
        </div>

        <div className="crm-settings-card-content">
          {loading ? (
            <div className="crm-settings-loading">
              <Loader2 className="spin" size={24} />
              <span>Memuat koneksi channel...</span>
            </div>
          ) : (
            <div className="crm-connectors-grid">
              {channels.map((ch) => {
                const isProcessing = actionLoading === ch.id;

                return (
                  <div
                    key={ch.id}
                    className={`crm-connector-card ${ch.isConnected ? "connected" : "disconnected"}`}
                  >
                    <div className="crm-connector-card-top">
                      <div className="crm-connector-avatar-row">
                        <span className={`crm-connector-avatar ${ch.id.toLowerCase()}`}>
                          {ch.initial}
                        </span>
                        <div className="crm-connector-identity">
                          <b className="crm-connector-name">{ch.name}</b>
                          <span className="crm-connector-account">
                            {ch.isConnected ? (ch.accountName || "Akun Terhubung") : "Belum Terhubung"}
                          </span>
                        </div>
                      </div>

                      <div className="crm-connector-status-badge-wrap">
                        {ch.isConnected ? (
                          ch.isExpired ? (
                            <span className="crm-status-pill red">
                              <span className="crm-status-dot" /> Expired
                            </span>
                          ) : ch.isExpiringSoon ? (
                            <span className="crm-status-pill amber">
                              <span className="crm-status-dot" /> Perlu Cek
                            </span>
                          ) : (
                            <span className="crm-status-pill green">
                              <span className="crm-status-dot" /> Terhubung
                            </span>
                          )
                        ) : (
                          <span className="crm-status-pill gray">
                            <span className="crm-status-dot" /> Non-Aktif
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="crm-connector-desc">{ch.desc}</p>

                    {ch.isConnected && (
                      <div className="crm-connector-mode-box">
                        <label className="crm-sublabel">Mode Publikasi:</label>
                        <select
                          className="crm-select-compact"
                          value={ch.deliveryMode}
                          disabled={isProcessing}
                          onChange={(e) => handleModeChange(ch.id, e.target.value as any)}
                        >
                          <option value="AUTO_PUBLISH">Auto-Publish Langsung</option>
                          <option value="PLATFORM_DRAFT">Simpan Sebagai Draft di Platform</option>
                          <option value="EXPORT_MANUAL">Ekspor Aset Manual</option>
                        </select>
                      </div>
                    )}

                    <div className="crm-connector-card-footer">
                      {ch.isConnected ? (
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary"
                          style={{ width: "100%" }}
                          disabled={isProcessing}
                          onClick={() => handleToggle(ch.id, true)}
                        >
                          {isProcessing ? <Loader2 className="spin" size={14} /> : <Unplug size={14} />}
                          <span>Putuskan Koneksi</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="crm-btn crm-btn-primary"
                          style={{ width: "100%" }}
                          disabled={isProcessing || !ch.supported}
                          onClick={() => handleToggle(ch.id, false)}
                        >
                          {isProcessing ? <Loader2 className="spin" size={14} /> : <PlugZap size={14} />}
                          <span>{ch.supported ? "Hubungkan Akun" : "Ekspor Manual Saja"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Safety & Token Guidelines */}
      <section className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge blue">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Keamanan Integrasi Akun</h2>
              <p className="crm-settings-subtitle">
                Routie menggunakan token akses resmi Meta & Platform API dengan hak akses minimal yang hanya digunakan untuk penerbitan konten terencana.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
