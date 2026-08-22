"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Layers3,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Zap
} from "lucide-react";

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setLoading(true);
      setStatus(null);
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name.trim() || undefined })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailSent(true);
        setStatus({
          success: true,
          message: data.message || "Tautan aktivasi workspace telah dikirim ke email Anda."
        });
      } else {
        setStatus({
          success: false,
          message: data.message || "Gagal memproses pendaftaran. Silakan periksa email Anda."
        });
      }
    } catch {
      setStatus({
        success: false,
        message: "Terjadi gangguan jaringan saat memproses pendaftaran."
      });
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignup() {
    setGoogleLoading(true);
    window.location.href = "/api/auth/google";
  }

  return (
    <div className="crm-auth-card">
      <div className="crm-auth-card-header">
        <Link href="/" className="crm-brand centered">
          <div className="crm-brand-logo">R</div>
          <div className="crm-brand-text">
            <span className="crm-brand-name">Routie</span>
            <span className="crm-brand-tag">CRM SaaS</span>
          </div>
        </Link>

        <h1 className="crm-auth-title">Daftar Workspace Baru</h1>
        <p className="crm-auth-subtitle">
          Mulai rencanakan dan otomatisasi 1 bulan konten media sosial brand Anda dalam hitungan menit.
        </p>
      </div>

      {status && (
        <div className={`crm-auth-alert ${status.success ? "success" : "error"}`}>
          {status.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{status.message}</span>
        </div>
      )}

      {emailSent ? (
        <div className="crm-auth-success-box">
          <div className="crm-auth-success-icon">
            <Inbox size={32} />
          </div>
          <h3>Konfirmasi Email Pendaftaran</h3>
          <p>
            Tautan aktivasi workspace baru telah dikirim ke <b>{email}</b>. Buka email Anda dan klik tombol aktivasi untuk langsung mengatur profil brand Anda.
          </p>
          <button
            type="button"
            className="crm-btn crm-btn-secondary full"
            onClick={() => {
              setEmailSent(false);
              setStatus(null);
            }}
          >
            Gunakan Email Lain
          </button>
        </div>
      ) : (
        <div className="crm-auth-form-wrap">
          {/* Option 1: Google Sign-Up */}
          <button
            type="button"
            className="crm-btn-google full"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{googleLoading ? "Menghubungkan Google..." : "Daftar Cepat dengan Google"}</span>
          </button>

          {/* Divider */}
          <div className="crm-auth-divider">
            <span>atau daftar dengan email</span>
          </div>

          {/* Option 2: Email Sign-Up Form */}
          <form onSubmit={handleSignupSubmit} className="crm-auth-email-form">
            <div className="crm-form-group">
              <label htmlFor="name" className="crm-form-label">
                Nama Lengkap / Nama Bisnis
              </label>
              <div className="crm-input-icon-wrap">
                <User size={16} className="crm-input-icon" />
                <input
                  id="name"
                  type="text"
                  placeholder="Contoh: Ibnu Soffyan / Nusa Brew"
                  className="crm-input with-icon"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="crm-form-group">
              <label htmlFor="signup-email" className="crm-form-label">
                Alamat Email Bisnis / Pribadi *
              </label>
              <div className="crm-input-icon-wrap">
                <Mail size={16} className="crm-input-icon" />
                <input
                  id="signup-email"
                  type="email"
                  required
                  placeholder="nama@perusahaan.com"
                  className="crm-input with-icon"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="crm-auth-features-preview">
              <div className="crm-auth-feature-bullet">
                <Sparkles size={14} className="text-primary" />
                <span>AI Generator & BYOK Multi-Model</span>
              </div>
              <div className="crm-auth-feature-bullet">
                <Layers3 size={14} className="text-primary" />
                <span>Auto-Publish YouTube Shorts, IG, TikTok</span>
              </div>
            </div>

            <button
              type="submit"
              className="crm-btn crm-btn-primary full"
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <>
                  <span>Buat Workspace Gratis</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Footer */}
      <div className="crm-auth-card-footer">
        <p className="crm-auth-footer-text">
          Sudah memiliki akun?{" "}
          <Link href="/login" className="crm-link-bold">
            Masuk ke Workspace
          </Link>
        </p>

        <div className="crm-auth-trust-note">
          <ShieldCheck size={14} />
          <span>Bagian dari ekosistem Mesin R1. Data & kunci API terenkripsi penuh.</span>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="crm-auth-page-container">
      <Suspense fallback={<div className="crm-auth-loading-placeholder"><Loader2 className="spin" size={28} /></div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
