"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  Building2,
  Cpu,
  Globe2,
  Palette,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";

export const SETTINGS_TABS = [
  {
    id: "brand-identity",
    href: "/settings/brand-identity",
    label: "Brand Identity",
    desc: "Profil brand, persona AI, warna & target pasar",
    icon: Palette
  },
  {
    id: "integration-api",
    href: "/settings/integration-api",
    label: "Integration API",
    desc: "Google AI Studio, model & generasi aset visual",
    icon: Cpu
  },
  {
    id: "manage-teams",
    href: "/settings/manage-teams",
    label: "Manage Teams",
    desc: "Akses kolaborasi, role anggota & matriks izin",
    icon: Users
  },
  {
    id: "connectors",
    href: "/settings/connectors",
    label: "Connectors",
    desc: "Integrasi akun sosial media & jadwal otomatis",
    icon: PlugZap
  },
  {
    id: "notifications",
    href: "/settings/notifications",
    label: "Notifications",
    desc: "Pengingat review, gagal posting & status token",
    icon: Bell
  },
  {
    id: "workspace",
    href: "/settings/workspace",
    label: "Workspace Preferences",
    desc: "Nama workspace, zona waktu, bahasa & kuota",
    icon: Globe2
  }
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <aside className="crm-settings-nav-pane">
      <div className="crm-settings-nav-header">
        <span className="crm-settings-nav-label">MENU PENGATURAN</span>
      </div>
      <nav className="crm-settings-nav-list">
        {SETTINGS_TABS.map((tab) => {
          const isActive = pathname === tab.href || (pathname === "/settings" && tab.id === "brand-identity");
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`crm-settings-nav-item ${isActive ? "active" : ""}`}
            >
              <div className="crm-settings-nav-item-icon">
                <Icon size={18} />
              </div>
              <div className="crm-settings-nav-item-meta">
                <div className="crm-settings-nav-item-title-row">
                  <span className="crm-settings-nav-item-title">{tab.label}</span>
                </div>
                <span className="crm-settings-nav-item-desc">{tab.desc}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
