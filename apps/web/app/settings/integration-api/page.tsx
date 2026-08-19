"use client";

import { AIIntegrationSection } from "@/components/settings-forms";
import { MediaAssetSection } from "@/components/media-asset-section";
import { Cpu, ImagePlus, Palette, ShieldCheck, Sparkles, Zap } from "lucide-react";

export default function IntegrationAPIPage() {
  return (
    <div className="crm-settings-vertical-stack">
      {/* Section 1: Google AI Studio */}
      <section className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge blue">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Integrasi Google AI Studio (Gemini)</h2>
              <p className="crm-settings-subtitle">
                Koneksikan API key Google AI Studio dari akun Google pribadi Anda (100% Gratis) untuk meriset ide konten yang menarik, viral, dan berbobot secara realtime.
              </p>
            </div>
          </div>
          <div className="crm-header-badges">
            <span className="crm-badge green">
              <Sparkles size={12} />
              <span>100% Gratis</span>
            </span>
            <span className="crm-badge green">
              <ShieldCheck size={12} />
              <span>Enkripsi AES-256</span>
            </span>
          </div>
        </div>

        <div className="crm-settings-card-content">
          <AIIntegrationSection />
        </div>
      </section>

      {/* Section 2: Social Media Asset Generation */}
      <section className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge purple">
              <ImagePlus size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Generasi Aset Media Visual (Image & Video)</h2>
              <p className="crm-settings-subtitle">
                Konfigurasi provider model AI untuk menghasilkan gambar ilustrasi postingan, cover carousel, dan video singkat.
              </p>
            </div>
          </div>
          <div className="crm-header-badges">
            <span className="crm-badge purple">
              <Palette size={12} />
              <span>Gambar & Video AI</span>
            </span>
            <span className="crm-badge green">
              <ShieldCheck size={12} />
              <span>Enkripsi AES-256</span>
            </span>
          </div>
        </div>

        <div className="crm-settings-card-content">
          <MediaAssetSection />
        </div>
      </section>

      {/* Section 3: Token Usage & Performance Notice */}
      <section className="crm-settings-card">
        <div className="crm-settings-card-header">
          <div className="crm-settings-title-group">
            <div className="crm-settings-icon-badge amber">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="crm-settings-title">Kuota & Penggunaan Token AI</h2>
              <p className="crm-settings-subtitle">
                Pantauan efisiensi pemakaian kuota API key Anda untuk produksi konten bulan ini.
              </p>
            </div>
          </div>
        </div>

        <div className="crm-settings-card-content">
          <div className="crm-token-meter-grid">
            <div className="crm-token-stat-box">
              <span className="crm-token-stat-label">Model Aktif</span>
              <b className="crm-token-stat-val text-blue">Gemini 2.5 Flash</b>
              <span className="crm-token-stat-sub">Latensi rendah (~1.2s per draf)</span>
            </div>
            <div className="crm-token-stat-box">
              <span className="crm-token-stat-label">Status Rate Limit</span>
              <b className="crm-token-stat-val text-green">15 RPM / 1M TPM (Free Tier)</b>
              <span className="crm-token-stat-sub">Sangat cukup untuk 100+ konten/bln</span>
            </div>
            <div className="crm-token-stat-box">
              <span className="crm-token-stat-label">Keamanan Kunci</span>
              <b className="crm-token-stat-val text-purple">Enkripsi Vault Workspace</b>
              <span className="crm-token-stat-sub">Hanya terbaca saat generasi konten</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
