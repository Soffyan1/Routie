"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Mail,
  MoreVertical,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users
} from "lucide-react";
import { InviteForm } from "@/components/settings-forms";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "EDITOR" | "APPROVER";
  joinedAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: "EDITOR" | "APPROVER";
  expiresAt: string;
  createdAt: string;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

export default function ManageTeamsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

  async function fetchTeam() {
    try {
      setLoading(true);
      const res = await fetch("/api/team/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setInvites(data.invitations || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeam();
  }, []);

  async function handleRoleChange(userId: string, newRole: "EDITOR" | "APPROVER") {
    try {
      setActionLoading(userId);
      setStatusMessage(null);
      const res = await fetch("/api/team/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole })
      });
      if (res.ok) {
        setStatusMessage({ success: true, text: "Peran anggota tim berhasil diperbarui." });
        await fetchTeam();
      } else {
        const data = await res.json();
        setStatusMessage({ success: false, text: data.message || "Gagal mengubah peran anggota." });
      }
    } catch {
      setStatusMessage({ success: false, text: "Kesalahan jaringan saat mengubah peran." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveMember(userId: string, name: string) {
    if (!confirm(`Apakah Anda yakin ingin menghapus ${name} dari workspace ini?`)) return;
    try {
      setActionLoading(userId);
      setStatusMessage(null);
      const res = await fetch("/api/team/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        setStatusMessage({ success: true, text: "Anggota tim berhasil dikeluarkan dari workspace." });
        await fetchTeam();
      } else {
        const data = await res.json();
        setStatusMessage({ success: false, text: data.message || "Gagal menghapus anggota tim." });
      }
    } catch {
      setStatusMessage({ success: false, text: "Kesalahan jaringan saat menghapus anggota." });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="crm-settings-vertical-stack">
      {/* Toast Alert */}
      {statusMessage && (
        <div className={`crm-status-toast-row ${statusMessage.success ? "success" : "error"}`}>
          {statusMessage.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Section 1: Active Team Members */}
      <section className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge amber">
              <Users size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Anggota Tim Aktif ({members.length})</h2>
              <p className="crm-settings-subtitle">
                Daftar kolaborator yang memiliki akses ke workspace ini dan dapat memproses alur kerja konten.
              </p>
            </div>
          </div>
        </div>

        <div className="crm-settings-card-content">
          {loading ? (
            <div className="crm-settings-loading">
              <Loader2 className="spin" size={24} />
              <span>Memuat anggota tim...</span>
            </div>
          ) : (
            <div className="crm-members-list">
              {members.map((member) => {
                const isOwner = member.role === "OWNER";
                const isProcessing = actionLoading === member.id;

                return (
                  <div key={member.id} className="crm-member-item-row">
                    <div className="crm-member-avatar-box">
                      {initials(member.name)}
                    </div>
                    <div className="crm-member-info-col">
                      <div className="crm-member-name-row">
                        <b className="crm-member-name">{member.name}</b>
                        {isOwner && (
                          <span className="crm-role-badge owner">
                            <Crown size={12} /> Owner
                          </span>
                        )}
                        {member.role === "EDITOR" && (
                          <span className="crm-role-badge editor">Editor</span>
                        )}
                        {member.role === "APPROVER" && (
                          <span className="crm-role-badge approver">Approver</span>
                        )}
                      </div>
                      <span className="crm-member-email">{member.email}</span>
                      <span className="crm-member-joined">
                        Bergabung sejak {new Date(member.joinedAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                      </span>
                    </div>

                    <div className="crm-member-actions-col">
                      {!isOwner && (
                        <div className="crm-member-role-select-wrap">
                          <label className="crm-sublabel">Ubah Hak Akses:</label>
                          <select
                            className="crm-select-compact"
                            value={member.role}
                            disabled={isProcessing}
                            onChange={(e) => handleRoleChange(member.id, e.target.value as "EDITOR" | "APPROVER")}
                          >
                            <option value="EDITOR">Editor (Buat Draf)</option>
                            <option value="APPROVER">Approver (Tinjau & Setujui)</option>
                          </select>
                        </div>
                      )}

                      {!isOwner && (
                        <button
                          type="button"
                          className="crm-icon-btn-danger"
                          title="Hapus Anggota"
                          disabled={isProcessing}
                          onClick={() => handleRemoveMember(member.id, member.name)}
                        >
                          {isProcessing ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
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

      {/* Section 2: Invite New Member */}
      <section className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge blue">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Undang Anggota Baru</h2>
              <p className="crm-settings-subtitle">
                Kirim tautan undangan aman (Magic Link) via email untuk mengajak rekan kerja bergabung ke workspace ini.
              </p>
            </div>
          </div>
        </div>

        <div className="crm-settings-card-content">
          <InviteForm />

          {/* Pending Invitations list */}
          {invites.length > 0 && (
            <div className="crm-pending-invites-section">
              <h4 className="crm-subheading">Undangan Menunggu Konfirmasi ({invites.length})</h4>
              <div className="crm-pending-invites-list">
                {invites.map((inv) => (
                  <div key={inv.id} className="crm-pending-invite-pill">
                    <div className="crm-pending-invite-meta">
                      <Mail size={14} className="text-blue" />
                      <span className="crm-pending-email">{inv.email}</span>
                      <span className="crm-pending-role">{inv.role}</span>
                    </div>
                    <span className="crm-pending-expiry">
                      <Clock size={12} /> Kadaluarsa: {new Date(inv.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Role & Permission Matrix */}
      <section className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge green">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Matriks Izin & Wewenang (Role Matrix)</h2>
              <p className="crm-settings-subtitle">
                Detail batas akses fitur berdasarkan peran masing-masing anggota di workspace.
              </p>
            </div>
          </div>
        </div>

        <div className="crm-settings-card-content">
          <div className="crm-matrix-table-wrap">
            <table className="crm-matrix-table">
              <thead>
                <tr>
                  <th>FITUR / AKSI</th>
                  <th style={{ width: "120px", textAlign: "center" }}>OWNER</th>
                  <th style={{ width: "120px", textAlign: "center" }}>EDITOR</th>
                  <th style={{ width: "120px", textAlign: "center" }}>APPROVER</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Generate Ide & Konsep AI</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-red">❌</td>
                </tr>
                <tr>
                  <td>Review & Setujui Konsep (Approval Center)</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-red">❌</td>
                  <td className="text-center text-green">✅</td>
                </tr>
                <tr>
                  <td>Ubah Identitas Brand & Template</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-red">❌</td>
                </tr>
                <tr>
                  <td>Kelola Kunci API & Media Engine</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-red">❌</td>
                  <td className="text-center text-red">❌</td>
                </tr>
                <tr>
                  <td>Hubungkan Channel Sosial Media</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-red">❌</td>
                </tr>
                <tr>
                  <td>Undang & Hapus Anggota Tim</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-red">❌</td>
                  <td className="text-center text-red">❌</td>
                </tr>
                <tr>
                  <td>Melihat Statistik & Laporan Performa</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-green">✅</td>
                  <td className="text-center text-green">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
