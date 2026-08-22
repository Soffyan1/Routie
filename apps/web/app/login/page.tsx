"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");
    const reason = searchParams.get("reason");
    if (reason === "session-expired") {
      setStatus({ success: false, message: "Sesi login Anda sudah berakhir. Silakan masuk kembali untuk melanjutkan." });
    } else if (errorParam) {
      setStatus({ success: false, message: decodeURIComponent(errorParam) });
    } else if (messageParam) {
      setStatus({ success: true, message: decodeURIComponent(messageParam) });
    }
  }, [searchParams]);

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setLoading(true);
      setStatus(null);
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailSent(true);
        setStatus({
          success: true,
          message: data.message || "Tautan masuk telah dikirim ke email Anda."
        });
      } else {
        setStatus({
          success: false,
          message: data.message || "Gagal mengirimkan tautan masuk. Silakan periksa email Anda."
        });
      }
    } catch {
      setStatus({
        success: false,
        message: "Terjadi gangguan jaringan saat mengirimkan tautan masuk."
      });
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
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

        <h1 className="crm-auth-title">Selamat Datang Kembali</h1>
        <p className="crm-auth-subtitle">
          Masuk ke workspace otomasi konten dan kalender media sosial Anda.
        </p>
      </div>

      {/* Mesin R1 Callout Badge */}
      <div className="crm-r1-callout">
        <div className="crm-r1-icon">
          <Sparkles size={15} />
        </div>
        <div className="crm-r1-text">
          <b>Pengguna Ekosistem Mesin R1?</b>
          <span>Gunakan email yang didaftarkan oleh admin R1 untuk langsung masuk ke workspace Anda.</span>
        </div>
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
          <h3>Periksa Inbox Gmail Anda</h3>
          <p>
            Kami telah mengirimkan tautan masuk aman ke <b>{email}</b>. Klik tombol pada email tersebut untuk langsung masuk ke dashboard.
          </p>
          <button
            type="button"
            className="crm-btn crm-btn-secondary full"
            onClick={() => {
              setEmailSent(false);
              setStatus(null);
            }}
          >
            Kirim Ulang atau Gunakan Email Lain
          </button>
        </div>
      ) : (
        <div className="crm-auth-form-wrap">
          {/* Option 1: Google One-Click Login */}
          <button
            type="button"
            className="crm-btn-google full"
            onClick={handleGoogleLogin}
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
            <span>{googleLoading ? "Menghubungkan Google..." : "Masuk dengan Google"}</span>
          </button>

          {/* Divider */}
          <div className="crm-auth-divider">
            <span>atau masuk dengan email</span>
          </div>

          {/* Option 2: Email Magic Link */}
          <form onSubmit={handleMagicLinkSubmit} className="crm-auth-email-form">
            <div className="crm-form-group">
              <label htmlFor="email" className="crm-form-label">
                Alamat Email Terdaftar
              </label>
              <div className="crm-input-icon-wrap">
                <Mail size={16} className="crm-input-icon" />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="nama@email.com"
                  className="crm-input with-icon"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
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
                  <span>Kirim Tautan Masuk Aman</span>
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
          Belum punya akun?{" "}
          <Link href="/signup" className="crm-link-bold">
            Daftar Akun Baru
          </Link>
        </p>

        <div className="crm-auth-trust-note">
          <ShieldCheck size={14} />
          <span>Keamanan terenkripsi AES-256 GCM tanpa risiko kata sandi bocor.</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="crm-auth-page-container">
      <Suspense fallback={<div className="crm-auth-loading-placeholder"><Loader2 className="spin" size={28} /></div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
