"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  Cpu,
  FileCheck2,
  Globe2,
  Home,
  Palette,
  PlugZap,
  Settings,
  Users
} from "lucide-react";

interface SidebarNavProps {
  approvalCount: number;
  active?: string;
}

const SETTINGS_SUBMENU = [
  { label: "Brand Identity", href: "/settings/brand-identity", icon: Palette },
  { label: "Integration API", href: "/settings/integration-api", icon: Cpu },
  { label: "Manage Teams", href: "/settings/manage-teams", icon: Users },
  { label: "Connectors", href: "/settings/connectors", icon: PlugZap },
  { label: "Notifications", href: "/settings/notifications", icon: Bell },
  { label: "Workspace Preferences", href: "/settings/workspace", icon: Globe2 }
];

export function SidebarNav({ approvalCount, active }: SidebarNavProps) {
  const pathname = usePathname();
  const isSettingsRoute = pathname.startsWith("/settings");

  // Keep settings open if currently on any settings subpage, or user toggled it
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  const mainNav = [
    { label: "Overview", href: "/dashboard", icon: Home },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    { label: "Approvals", href: "/approvals", icon: FileCheck2, badge: approvalCount },
    { label: "Statistik", href: "/analytics", icon: BarChart3 }
  ];

  return (
    <div className="crm-sidebar-body">
      {/* Group 1: MAIN MENU */}
      <div className="crm-nav-group">
        <span className="crm-nav-heading">MAIN MENU</span>
        <nav className="crm-nav-list">
          {mainNav.map(({ label, href, icon: Icon, badge }) => {
            const isActive =
              pathname === href ||
              (href === "/dashboard" && pathname === "/dashboard") ||
              (active === label && !isSettingsRoute);

            return (
              <Link
                key={label}
                href={href}
                className={`crm-nav-item ${isActive ? "active" : ""}`}
              >
                <Icon size={17} className="crm-nav-icon" />
                <span className="crm-nav-label">{label}</span>
                {Boolean(badge && badge > 0) && (
                  <span className="crm-nav-badge">{badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Group 2: MANAGEMENT with Expandable Settings */}
      <div className="crm-nav-group">
        <span className="crm-nav-heading">MANAGEMENT</span>
        <nav className="crm-nav-list">
          {/* Settings Parent Item / Accordion Trigger */}
          <div className="crm-nav-accordion-item">
            <button
              type="button"
              className={`crm-nav-item crm-nav-item-dropdown-trigger ${isSettingsRoute ? "active" : ""}`}
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
              <div className="crm-nav-item-left">
                <Settings size={17} className="crm-nav-icon" />
                <span className="crm-nav-label">Settings</span>
              </div>
              <ChevronDown
                size={14}
                className={`crm-nav-chevron ${isSettingsOpen ? "expanded" : ""}`}
              />
            </button>

            {/* Sub-menu Dropdown List */}
            {isSettingsOpen && (
              <div className="crm-nav-submenu-list">
                {SETTINGS_SUBMENU.map(({ label, href, icon: SubIcon }) => {
                  const isSubActive = pathname === href;

                  return (
                    <Link
                      key={label}
                      href={href}
                      className={`crm-nav-submenu-item ${isSubActive ? "active" : ""}`}
                    >
                      <SubIcon size={14} className="crm-nav-submenu-icon" />
                      <span className="crm-nav-submenu-label">{label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
