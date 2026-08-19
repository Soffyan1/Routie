import { AppShell } from "@/components/app-shell";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Sparkles } from "lucide-react";

export default function SettingsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell active="Settings">
      <div className="crm-page-container">
        {/* Top Header */}
        <section className="crm-page-header">
          <div className="crm-header-info">
            <span className="crm-header-date">PENGATURAN & INTEGRASI</span>
            <h1 className="crm-page-title">Pengaturan Workspace</h1>
            <p className="crm-page-desc">
              Konfigurasikan identitas brand, integrasi AI, izin tim, koneksi media sosial, dan template konten workspace Anda.
            </p>
          </div>
        </section>

        {/* Settings Content Area */}
        <div className="crm-settings-content-wrap">
          {children}
        </div>
      </div>
    </AppShell>
  );
}
