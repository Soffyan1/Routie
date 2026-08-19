import Link from "next/link";
import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { OnboardingForm } from "@/components/onboarding-form";

export default function OnboardingPage() {
  return (
    <div className="crm-wizard-layout">
      {/* Wizard Left Sidebar */}
      <aside className="crm-wizard-sidebar">
        <Link href="/" className="crm-brand light">
          <div className="crm-brand-logo">R</div>
          <div className="crm-brand-text">
            <span className="crm-brand-name">Routie</span>
            <span className="crm-brand-tag light">Setup Wizard</span>
          </div>
        </Link>

        <div className="crm-wizard-intro">
          <span className="crm-wizard-eyebrow">WORKSPACE ONBOARDING</span>
          <h1 className="crm-wizard-headline">Ajari Routie cara bicara seperti brand kamu.</h1>
          <p className="crm-wizard-desc">
            Semakin presisi konteks dan tone of voice yang kamu masukkan, semakin sedikit waktu yang dihabiskan untuk revisi konten.
          </p>
        </div>

        {/* Step Progress Tracker */}
        <ol className="crm-wizard-steps">
          <li className="crm-wizard-step active">
            <span className="crm-step-num"><Check size={14} /></span>
            <div className="crm-step-text">
              <b>1. Profil & Target Brand</b>
              <small>Identitas bisnis dan audiens</small>
            </div>
          </li>
          <li className="crm-wizard-step">
            <span className="crm-step-num">2</span>
            <div className="crm-step-text">
              <b>2. Dokumen & Visual Brand</b>
              <small>Website, logo, dan panduan</small>
            </div>
          </li>
          <li className="crm-wizard-step">
            <span className="crm-step-num">3</span>
            <div className="crm-step-text">
              <b>3. Model AI & API Keys</b>
              <small>Koneksi BYOK Text, Image, Video</small>
            </div>
          </li>
          <li className="crm-wizard-step">
            <span className="crm-step-num">4</span>
            <div className="crm-step-text">
              <b>4. Channel Media Sosial</b>
              <small>Instagram, TikTok, YouTube Shorts</small>
            </div>
          </li>
        </ol>

        <div className="crm-wizard-security-note">
          <ShieldCheck size={16} />
          <span>Kredensial disimpan dengan envelope encryption AES-256 GCM.</span>
        </div>
      </aside>

      {/* Wizard Content Area */}
      <main className="crm-wizard-main">
        <div className="crm-wizard-topbar">
          <span className="crm-wizard-step-badge">Langkah 1 dari 4</span>
          <Link href="/dashboard" className="crm-wizard-skip-link">
            Lewati onboarding untuk sekarang &rarr;
          </Link>
        </div>

        <div className="crm-wizard-header">
          <span className="crm-wizard-category">BRAND FOUNDATION</span>
          <h2 className="crm-wizard-title">Mulai dari konteks yang benar.</h2>
          <p className="crm-wizard-subtitle">
            Routie tidak akan menebak-nebak identitas bisnismu. Berikan detail produk dan audiens untuk kalender yang relevan.
          </p>
        </div>

        <OnboardingForm />
      </main>
    </div>
  );
}
