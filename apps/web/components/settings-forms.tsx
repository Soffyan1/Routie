"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus
} from "lucide-react";
import { GoogleAISetupGuide } from "./google-ai-setup-guide";

type CredentialStatus = {
  isConfigured: boolean;
  provider: string | null;
  secretLastFour: string | null;
  validatedAt: string | null;
  capabilities: string[];
};

export function AIIntegrationSection() {
  const [loading, setLoading] = useState(true);
  const [credStatus, setCredStatus] = useState<CredentialStatus | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [testingLive, setTestingLive] = useState(false);
  const [testMessage, setTestMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch current provider status
  async function fetchStatus() {
    try {
      setLoading(true);
      const res = await fetch("/api/provider-credentials");
      if (res.ok) {
        const data = (await res.json()) as CredentialStatus;
        setCredStatus(data);
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

  // Live test stored key
  async function handleTestLive() {
    setTestingLive(true);
    setTestMessage(null);
    try {
      const res = await fetch("/api/provider-credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (res.ok && data.success) {
        setTestMessage({
          success: true,
          text: data.message || "Koneksi Google AI Studio aktif & berfungsi dengan baik."
        });
      } else {
        setTestMessage({
          success: false,
          text: data.message || "Kunci API tidak valid atau ditolak oleh Google."
        });
      }
    } catch {
      setTestMessage({
        success: false,
        text: "Gagal menguji koneksi. Silakan periksa koneksi internet Anda."
      });
    } finally {
      setTestingLive(false);
    }
  }

  // Delete stored key
  async function handleDeleteKey() {
    setDeleting(true);
    try {
      const res = await fetch("/api/provider-credentials", {
        method: "DELETE"
      });
      if (res.ok) {
        setShowDeleteModal(false);
        setTestMessage(null);
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
        <span>Memuat status integrasi AI...</span>
      </div>
    );
  }

  // If already configured and not in edit mode
  if (credStatus?.isConfigured && !isEditing) {
    return (
      <div className="crm-ai-connected-container">
        {/* Connected Card View */}
        <div className="crm-ai-connected-card">
          <div className="crm-ai-connected-header">
            <div className="crm-ai-connected-info">
              <div className="crm-ai-logo-box">
                <Sparkles size={20} className="crm-ai-logo-icon" />
              </div>
              <div>
                <div className="crm-ai-title-row">
                  <h3 className="crm-ai-main-title">Google AI Studio (Gemini)</h3>
                  <span className="crm-badge green">
                    <span className="crm-badge-dot green" />
                    <span>Terhubung & Aktif</span>
                  </span>
                </div>
                <p className="crm-ai-subtitle">
                  Menggunakan API Key akun Google pribadi Anda untuk riset tren dan pembuatan konten.
                </p>
              </div>
            </div>
          </div>

          <div className="crm-ai-details-grid">
            <div className="crm-ai-detail-item">
              <span className="crm-ai-detail-label">Kunci API Terpasang</span>
              <div className="crm-ai-key-display">
                <Lock size={13} />
                <code>•••• •••• •••• {credStatus.secretLastFour || "••••"}</code>
              </div>
            </div>

            <div className="crm-ai-detail-item">
              <span className="crm-ai-detail-label">Model AI Utama</span>
              <span className="crm-ai-detail-value">Google Gemini 3.5 Flash</span>
            </div>

            <div className="crm-ai-detail-item">
              <span className="crm-ai-detail-label">Kemampuan Aktif</span>
              <div className="crm-ai-tags-row">
                <span className="crm-ai-tag">Teks & Caption</span>
                <span className="crm-ai-tag">Riset Google Search</span>
                <span className="crm-ai-tag">Generasi Gambar</span>
              </div>
            </div>

            <div className="crm-ai-detail-item">
              <span className="crm-ai-detail-label">Terakhir Divalidasi</span>
              <span className="crm-ai-detail-value">
                {credStatus.validatedAt
                  ? new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    }).format(new Date(credStatus.validatedAt))
                  : "Aktif"}
              </span>
            </div>
          </div>

          {/* Test Live Message */}
          {testMessage && (
            <div className={`crm-ai-alert-box ${testMessage.success ? "success" : "error"}`}>
              {testMessage.success ? (
                <CheckCircle2 size={16} className="crm-ai-alert-icon" />
              ) : (
                <AlertCircle size={16} className="crm-ai-alert-icon" />
              )}
              <div className="crm-ai-alert-content">
                <b className="crm-ai-alert-heading">
                  {testMessage.success ? "Hasil Uji Koneksi: Berhasil" : "Hasil Uji Koneksi: Gagal"}
                </b>
                <p className="crm-ai-alert-desc">{testMessage.text}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="crm-ai-connected-actions">
            <button
              type="button"
              onClick={handleTestLive}
              disabled={testingLive}
              className="crm-btn crm-btn-secondary"
            >
              {testingLive ? (
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
                setTestMessage(null);
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
              <span>Hapus Kunci</span>
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
                  <h3>Hapus Kunci Google AI?</h3>
                </div>
              </div>
              <div className="crm-modal-body">
                <p>
                  Setelah dihapus, Routie tidak dapat membuat draf konten atau melakukan riset tren
                  otomatis hingga Anda memasukkan kunci API baru.
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
                  <span>{deleting ? "Menghapus..." : "Ya, Hapus Kunci"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If not configured, or editing
  return (
    <div className="crm-ai-unconfigured-container">
      <GoogleAISetupGuide
        isEditMode={isEditing}
        onCancel={isEditing ? () => setIsEditing(false) : undefined}
        onSuccess={async () => {
          setIsEditing(false);
          await fetchStatus();
        }}
      />
    </div>
  );
}

// Backward compatibility export
export const ProviderForm = AIIntegrationSection;

export function InviteForm({ onSuccess }: { onSuccess?: () => void | Promise<void> } = {}) {
  const [status, setStatus] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data))
      });
      const body = (await response.json()) as { message?: string };
      if (response.ok) {
        setIsSuccess(true);
        setStatus("Undangan berhasil dikirim ke email tujuan.");
        form.reset();
        await onSuccess?.();
      } else {
        setIsSuccess(false);
        setStatus(body.message ?? "Gagal mengirim undangan.");
      }
    } catch {
      setIsSuccess(false);
      setStatus("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="crm-team-invite-grid" onSubmit={submit}>
      <div className="crm-form-group" style={{ flex: 2 }}>
        <label className="crm-label">Alamat Email Anggota</label>
        <input
          name="email"
          type="email"
          placeholder="nama@perusahaan.com"
          className="crm-input"
          required
        />
      </div>

      <div className="crm-form-group" style={{ flex: 1 }}>
        <label className="crm-label">Peran (Role)</label>
        <select name="role" defaultValue="EDITOR" className="crm-select">
          <option value="EDITOR">Editor (Membuat Draf)</option>
          <option value="APPROVER">Approver (Tinjau & Setujui)</option>
        </select>
      </div>

      <div className="crm-form-actions-inline">
        <button type="submit" className="crm-btn crm-btn-primary" disabled={loading}>
          {loading ? <Loader2 className="spin" size={15} /> : <UserPlus size={15} />}
          <span>Kirim Undangan</span>
        </button>
      </div>

      {status && (
        <div className={`crm-status-toast-row ${isSuccess ? "success" : "error"}`}>
          {isSuccess ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{status}</span>
        </div>
      )}
    </form>
  );
}
