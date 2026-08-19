import Link from "next/link";
import {
  Bell,
  Settings
} from "lucide-react";
import { connection } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { contentConcepts, createDatabase, notifications, users, withTenant, workspaces } from "@routie/db";
import type { WorkspaceRole } from "@routie/domain";
import { requireSession } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

interface AppShellIdentity {
  workspaceName: string;
  userName: string;
  role: WorkspaceRole;
  approvalCount: number;
  unreadCount: number;
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "R";
}

async function loadIdentity(): Promise<AppShellIdentity> {
  const session = await requireSession();
  const db = createDatabase(serverEnv().DATABASE_URL);
  return withTenant(db, session.workspaceId, async (tx) => {
    const [identity, approvals, unread] = await Promise.all([
      tx.select({ workspaceName: workspaces.name, userName: users.name }).from(workspaces).innerJoin(users, eq(users.id, session.sub)).where(eq(workspaces.id, session.workspaceId)).limit(1),
      tx.select({ id: contentConcepts.id }).from(contentConcepts).where(and(eq(contentConcepts.workspaceId, session.workspaceId), inArray(contentConcepts.state, ["IDEA_REVIEW", "FINAL_REVIEW"]))),
      tx.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.workspaceId, session.workspaceId), isNull(notifications.readAt)))
    ]);
    return {
      workspaceName: identity[0]?.workspaceName ?? "Workspace",
      userName: identity[0]?.userName ?? session.email,
      role: session.role,
      approvalCount: approvals.length,
      unreadCount: unread.length
    };
  });
}

import { SidebarNav } from "./sidebar-nav";

export async function AppShell({
  children,
  active = "Overview",
  identity: suppliedIdentity
}: {
  children: React.ReactNode;
  active?: string;
  identity?: AppShellIdentity;
}) {
  await connection();
  const identity = suppliedIdentity ?? await loadIdentity();

  return (
    <div className="crm-layout">
      {/* Sidebar Navigation */}
      <aside className="crm-sidebar">
        {/* Brand */}
        <div className="crm-sidebar-header">
          <Link href="/dashboard" className="crm-brand">
            <div className="crm-brand-logo">R</div>
            <div className="crm-brand-text">
              <span className="crm-brand-name">Routie</span>
              <span className="crm-brand-tag">CRM SaaS</span>
            </div>
          </Link>
        </div>

        {/* Navigation Groups with Expandable Settings */}
        <SidebarNav approvalCount={identity.approvalCount} active={active} />

        {/* User Profile Card */}
        <div className="crm-sidebar-footer">
          <div className="crm-user-card">
            <div className="crm-user-avatar">
              {initials(identity.userName)}
              <span className="crm-online-dot" />
            </div>
            <div className="crm-user-info">
              <span className="crm-user-name">{identity.userName}</span>
              <span className="crm-user-role">{identity.role.toLowerCase()}</span>
            </div>
            <Link href="/settings/brand-identity" className="crm-user-settings-btn" title="Settings">
              <Settings size={15} />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="crm-main-wrap">
        {/* Top App Header */}
        <header className="crm-top-header">
          <div className="crm-header-left">
            <div className="crm-breadcrumb">
              <span className="crm-breadcrumb-root">Routie</span>
              <span className="crm-breadcrumb-sep">/</span>
              <span className="crm-breadcrumb-current">{active}</span>
            </div>
          </div>

          <div className="crm-header-right">
            <button className="crm-icon-btn" aria-label="Notifications" title="Notifications">
              <Bell size={17} />
              {identity.unreadCount > 0 && <span className="crm-bell-dot" />}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="crm-page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
