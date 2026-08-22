"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  PlugZap,
  RefreshCw,
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
  status: "CONNECTED" | "RECONNECT_REQUIRED" | "DISCONNECTED";
  requiresReconnect: boolean;
  accountName: string | null;
  deliveryMode: "AUTO_PUBLISH" | "PLATFORM_DRAFT" | "EXPORT_MANUAL";
  autoPublishEnabled: boolean;
  draftSyncEnabled?: boolean;
  connectedAt: string | null;
}

interface MetaPageOption {
  id: string;
  name: string;
  hasInstagram: boolean;
}

const DEFAULT_CHANNELS: ChannelConnection[] = [
  ["INSTAGRAM", "Instagram", "In", "Meta Graph API (IG Professional & Creator)"],
  ["FACEBOOK", "Facebook", "Fb", "Meta Pages API Integration"],
  ["TIKTOK", "TikTok", "Tk", "TikTok Content Posting API v2"],
  ["THREADS", "Threads", "Th", "Meta Threads Publishing API"],
  ["YOUTUBE", "YouTube", "Yt", "Google YouTube Data API v3"],
  ["X", "X (Twitter)", "X", "Export zip & scheduled draft mode"]
].map(([id, name, initial, desc]) => ({
  id: id as ChannelConnection["id"], name, initial, desc,
  defaultMode: id === "TIKTOK" ? "Draft TikTok" : "Auto-Publish Langsung", supported: id !== "X",
  isConnected: false, status: "DISCONNECTED", requiresReconnect: false,
  accountName: null, deliveryMode: "AUTO_PUBLISH", autoPublishEnabled: false, connectedAt: null
})) as ChannelConnection[];

function SocialLogo({ channel }: { channel: ChannelConnection["id"] }) {
  if (channel === "INSTAGRAM") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="17.4" cy="6.7" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (channel === "FACEBOOK") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M13.8 21v-8h2.8l.42-3.2H13.8V7.75c0-.93.26-1.56 1.62-1.56h1.73V3.33a23 23 0 0 0-2.52-.13c-2.5 0-4.2 1.52-4.2 4.32V9.8H7.6V13h2.83v8h3.37Z" />
      </svg>
    );
  }
  if (channel === "TIKTOK") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="tiktok-shadow-cyan" d="M14.3 3v10.25a4.55 4.55 0 1 1-3.85-4.5v2.72a1.9 1.9 0 1 0 1.2 1.78V3h2.65Zm0 0c.36 2.2 1.65 3.52 3.7 4.05v2.73c-1.47-.06-2.74-.5-3.7-1.2" />
        <path className="tiktok-shadow-red" d="M15.25 3v10.25a4.55 4.55 0 1 1-3.85-4.5v2.72a1.9 1.9 0 1 0 1.2 1.78V3h2.65Zm0 0c.36 2.2 1.65 3.52 3.7 4.05v2.73c-1.47-.06-2.74-.5-3.7-1.2" />
        <path fill="currentColor" d="M14.78 3v10.25a4.55 4.55 0 1 1-3.85-4.5v2.72a1.9 1.9 0 1 0 1.2 1.78V3h2.65Zm0 0c.36 2.2 1.65 3.52 3.7 4.05v2.73c-1.47-.06-2.74-.5-3.7-1.2" />
      </svg>
    );
  }
  if (channel === "THREADS") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M17.9 9.2c-.7-3-2.75-4.7-5.75-4.7-3.75 0-6.15 2.8-6.15 7.4 0 4.65 2.4 7.6 6.25 7.6 3.5 0 5.75-2 5.75-4.65 0-2.25-1.55-3.7-4.2-3.7-2.45 0-4.05 1.15-4.05 2.85 0 1.3 1 2.2 2.5 2.2 2.75 0 4.65-2.55 4.25-5.75-.25-2.1-1.5-3.8-3.65-4.65" />
      </svg>
    );
  }
  if (channel === "YOUTUBE") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M21.55 7.2a2.8 2.8 0 0 0-1.97-1.98C17.84 4.75 12 4.75 12 4.75s-5.84 0-7.58.47A2.8 2.8 0 0 0 2.45 7.2 29.4 29.4 0 0 0 2 12a29.4 29.4 0 0 0 .45 4.8 2.8 2.8 0 0 0 1.97 1.98c1.74.47 7.58.47 7.58.47s5.84 0 7.58-.47a2.8 2.8 0 0 0 1.97-1.98A29.4 29.4 0 0 0 22 12a29.4 29.4 0 0 0-.45-4.8Z" />
        <path fill="#fff" d="m10 15.2 5.2-3.2L10 8.8v6.4Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18.24 2.25h3.31l-7.23 8.26 8.51 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}

export default function ConnectorsPage() {
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [metaPages, setMetaPages] = useState<MetaPageOption[] | null>(null);
  const [metaSelectionLoading, setMetaSelectionLoading] = useState(false);
  const [showMetaSelection, setShowMetaSelection] = useState(false);

  async function fetchConnections() {
    try {
      setLoading(true);
      const res = await fetch("/api/social/connections");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels?.length ? data.channels : DEFAULT_CHANNELS);
      } else {
        setChannels(DEFAULT_CHANNELS);
      }
    } catch {
      setChannels(DEFAULT_CHANNELS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConnections();

    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    const needsMetaSelection = params.get("meta_select") === "1";
    if (connected) {
      setStatusMessage({
        success: true,
        text: `Akun ${connected} resmi berhasil terhubung dengan aman.`
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      setStatusMessage({
        success: false,
        text: decodeURIComponent(error)
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (needsMetaSelection) {
      setShowMetaSelection(true);
      setMetaSelectionLoading(true);
      fetch("/api/auth/meta/accounts")
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Gagal memuat Facebook Page.");
          setMetaPages(data.pages || []);
        })
        .catch((selectionError) => {
          setStatusMessage({
            success: false,
            text: selectionError instanceof Error ? selectionError.message : "Gagal memuat akun Meta."
          });
          setShowMetaSelection(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .finally(() => setMetaSelectionLoading(false));
    }
  }, []);

  async function selectMetaPage(pageId: string) {
    try {
      setMetaSelectionLoading(true);
      const response = await fetch("/api/auth/meta/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal menghubungkan akun Meta.");
      setMetaPages(null);
      setShowMetaSelection(false);
      setStatusMessage({ success: true, text: `Akun ${data.connected} berhasil terhubung.` });
      window.history.replaceState({}, document.title, window.location.pathname);
      await fetchConnections();
    } catch (error) {
      setStatusMessage({
        success: false,
        text: error instanceof Error ? error.message : "Gagal menghubungkan akun Meta."
      });
    } finally {
      setMetaSelectionLoading(false);
    }
  }

  async function handleToggle(channelId: string, status: ChannelConnection["status"]) {
    const isCurrentlyConnected = status === "CONNECTED";
    if (channelId === "TIKTOK" && !isCurrentlyConnected) {
      window.location.href = "/api/auth/tiktok";
      return;
    }
    if (channelId === "YOUTUBE" && !isCurrentlyConnected) {
      window.location.href = "/api/auth/youtube";
      return;
    }
    if ((channelId === "INSTAGRAM" || channelId === "FACEBOOK") && !isCurrentlyConnected) {
      window.location.href = `/api/auth/meta?channel=${channelId}`;
      return;
    }
    if (channelId === "THREADS" && !isCurrentlyConnected) {
      window.location.href = "/api/auth/threads";
      return;
    }

    try {
      setActionLoading(channelId);
      setStatusMessage(null);
      if (!isCurrentlyConnected) throw new Error("Channel ini harus dihubungkan melalui login resmi platform.");
      const res = await fetch("/api/social/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channelId, action: "disconnect" })
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

  const reconnectChannels = channels.filter((c) => c.status === "RECONNECT_REQUIRED");
  const connectedCount = channels.filter((c) => c.status === "CONNECTED").length;
  const connectableCount = channels.filter((c) => c.supported).length;

  return (
    <div className="crm-settings-vertical-stack">
      {/* Toast Alert */}
      {statusMessage && (
        <div className={`crm-status-toast-row ${statusMessage.success ? "success" : "error"}`}>
          {statusMessage.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Only show an action when Google genuinely requires user consent again. */}
      {reconnectChannels.length > 0 && (
        <div className="crm-settings-alert-banner amber">
          <AlertTriangle size={18} />
          <div>
            <b>Ada akun yang perlu disambungkan ulang</b>
            <p>
              Routie akan menjaga koneksi secara otomatis. Satu akun perlu izin platform sekali lagi agar publikasi terjadwal dapat dilanjutkan.
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
            <>
              <div className="crm-connectors-overview">
                <div className="crm-connectors-overview-copy">
                  <span className="crm-connectors-count">{connectedCount}/{connectableCount}</span>
                  <div>
                    <b>Channel aktif</b>
                    <p>Hubungkan sekali—Routie menjaga sesi akun dan token secara otomatis.</p>
                  </div>
                </div>
                <span className="crm-connectors-managed-badge"><ShieldCheck size={15} /> Koneksi dikelola otomatis</span>
              </div>
              <div className="crm-connectors-grid">
              {channels.map((ch) => {
                const isProcessing = actionLoading === ch.id;

                return (
                  <div
                    key={ch.id}
                    className={`crm-connector-card ${ch.status === "CONNECTED" ? "connected" : ch.status === "RECONNECT_REQUIRED" ? "reconnect-required" : "disconnected"}`}
                  >
                    <div className="crm-connector-card-top">
                      <div className="crm-connector-avatar-row">
                        <span className={`crm-connector-avatar ${ch.id.toLowerCase()}`} aria-label={`Logo ${ch.name}`}>
                          <SocialLogo channel={ch.id} />
                        </span>
                        <div className="crm-connector-identity">
                          <b className="crm-connector-name">{ch.name}</b>
                          <span className="crm-connector-account">
                            {ch.isConnected ? (ch.accountName || "Akun Terhubung") : "Belum Terhubung"}
                          </span>
                        </div>
                      </div>

                      <div className="crm-connector-status-badge-wrap">
                        {ch.status === "CONNECTED" ? (
                          <span className="crm-status-pill green"><span className="crm-status-dot" /> Terhubung</span>
                        ) : ch.status === "RECONNECT_REQUIRED" ? (
                          <span className="crm-status-pill amber"><span className="crm-status-dot" /> Perlu Disambungkan Ulang</span>
                        ) : (
                          <span className="crm-status-pill gray"><span className="crm-status-dot" /> Belum Terhubung</span>
                        )}
                      </div>
                    </div>

                    <div className="crm-connector-body">
                      <p className="crm-connector-desc">{ch.desc}</p>
                      <div className="crm-connector-capabilities" aria-label={`Fitur ${ch.name}`}>
                        <span>{ch.id === "TIKTOK" ? "Foto & video pendek" : ch.supported ? "Publikasi otomatis" : "Ekspor manual"}</span>
                        {ch.id === "TIKTOK" ? <span>Draft aman</span> : ch.supported && <span>Sinkronisasi aman</span>}
                      </div>
                    </div>

                    {ch.status === "CONNECTED" && ch.id === "TIKTOK" ? (
                      <div className="crm-connector-mode-box">
                        <label className="crm-sublabel">Mode TikTok:</label>
                        <div className="crm-select-compact" aria-live="polite">
                          {ch.draftSyncEnabled
                            ? "Video dikirim ke inbox TikTok untuk finalisasi"
                            : "Koneksi siap — Draft TikTok aktif setelah persetujuan platform"}
                        </div>
                      </div>
                    ) : ch.status === "CONNECTED" && (ch.id === "FACEBOOK" || ch.id === "INSTAGRAM" || ch.id === "THREADS") ? (
                      <div className="crm-connector-mode-box">
                        <label className="crm-sublabel">Publikasi:</label>
                        <div className="crm-select-compact" aria-live="polite">
                          {ch.autoPublishEnabled ? "Otomatis dikelola Routie" : "Menunggu aktivasi administrator"}
                        </div>
                      </div>
                    ) : ch.status === "CONNECTED" ? (
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
                    ) : null}

                    <div className="crm-connector-card-footer">
                      {ch.status === "CONNECTED" ? (
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary"
                          disabled={isProcessing}
                          onClick={() => handleToggle(ch.id, ch.status)}
                        >
                          {isProcessing ? <Loader2 className="spin" size={14} /> : <Unplug size={14} />}
                          <span>Putuskan Koneksi</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="crm-btn crm-btn-primary"
                          disabled={isProcessing || !ch.supported}
                          onClick={() => handleToggle(ch.id, ch.status)}
                        >
                          {isProcessing ? <Loader2 className="spin" size={14} /> : ch.status === "RECONNECT_REQUIRED" ? <RefreshCw size={14} /> : <PlugZap size={14} />}
                          <span>{ch.status === "RECONNECT_REQUIRED" ? "Sambungkan Ulang" : ch.supported ? "Hubungkan Akun" : "Ekspor Manual Saja"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </>
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

      {showMetaSelection && (
        <div className="crm-modal-backdrop" role="presentation">
          <div className="crm-modal-container crm-meta-account-modal" role="dialog" aria-modal="true" aria-labelledby="meta-account-title">
            <header className="crm-modal-header">
              <div className="crm-modal-icon-wrap" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                <Building2 size={22} />
              </div>
              <div className="crm-modal-title-wrap">
                <span className="crm-modal-eyebrow">PILIH AKUN META</span>
                <h2 id="meta-account-title" className="crm-modal-title">Pilih bisnis yang ingin dihubungkan</h2>
                <p className="crm-modal-desc">Pilihan ini hanya muncul karena akun Meta Anda mengelola lebih dari satu Facebook Page.</p>
              </div>
            </header>
            <div className="crm-meta-account-list">
              {metaSelectionLoading && !metaPages ? (
                <div className="crm-settings-loading"><Loader2 className="spin" size={22} /> Memuat akun...</div>
              ) : (
                metaPages?.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className="crm-meta-account-option"
                    disabled={metaSelectionLoading}
                    onClick={() => selectMetaPage(page.id)}
                  >
                    <span className="crm-connector-avatar facebook"><SocialLogo channel="FACEBOOK" /></span>
                    <span><b>{page.name}</b><small>{page.hasInstagram ? "Facebook + Instagram terhubung" : "Facebook Page"}</small></span>
                    {metaSelectionLoading ? <Loader2 className="spin" size={18} /> : <span aria-hidden="true">→</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
