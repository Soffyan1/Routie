"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  Info,
  KeyRound,
  Loader2,
  Settings,
  Sparkles,
  Trash2,
  X
} from "lucide-react";

export interface NotificationItem {
  id: string;
  workspaceId: string;
  userId: string | null;
  kind: "APPROVAL_REQUIRED" | "PUBLISH_FAILED" | "TOKEN_EXPIRED" | "ENTITLEMENT_CHANGED" | "EXPORT_READY" | string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  emailedAt: string | null;
  createdAt: string;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari yang lalu`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date);
}

function getNotificationIcon(kind: string) {
  switch (kind) {
    case "APPROVAL_REQUIRED":
      return { icon: FileCheck2, tone: "amber" };
    case "PUBLISH_FAILED":
      return { icon: AlertTriangle, tone: "red" };
    case "TOKEN_EXPIRED":
      return { icon: KeyRound, tone: "purple" };
    case "ENTITLEMENT_CHANGED":
      return { icon: Sparkles, tone: "blue" };
    case "EXPORT_READY":
    default:
      return { icon: CheckCircle2, tone: "green" };
  }
}

export function NotificationBell({ initialUnreadCount = 0 }: { initialUnreadCount?: number }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications from API
  async function loadNotifications() {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications?limit=30");
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Load when opened
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Mark single notification as read
  async function markAsRead(item: NotificationItem) {
    if (item.readAt) {
      if (item.actionUrl) {
        setIsOpen(false);
        router.push(item.actionUrl);
      }
      return;
    }

    try {
      // Optimistic update
      setItems((curr) =>
        curr.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });

      if (item.actionUrl) {
        setIsOpen(false);
        router.push(item.actionUrl);
      }
    } catch {
      // ignore
    }
  }

  // Mark all as read
  async function markAllAsRead() {
    try {
      setMarkingAll(true);
      // Optimistic update
      setItems((curr) => curr.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      setUnreadCount(0);

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      });
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  }

  const filteredItems = items.filter((item) => (filter === "UNREAD" ? !item.readAt : true));

  return (
    <div className="crm-notif-wrapper" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`crm-icon-btn ${isOpen ? "active" : ""}`}
        aria-label="Notifikasi"
        title="Notifikasi"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={17} />
        {unreadCount > 0 && <span className="crm-bell-dot" />}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="crm-notif-popover" role="dialog" aria-modal="true">
          {/* Header */}
          <div className="crm-notif-header">
            <div className="crm-notif-title-row">
              <div className="crm-notif-title-group">
                <h3 className="crm-notif-heading">Notifikasi</h3>
                {unreadCount > 0 && (
                  <span className="crm-badge blue">
                    {unreadCount} baru
                  </span>
                )}
              </div>
              <div className="crm-notif-header-actions">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="crm-notif-action-btn"
                    onClick={markAllAsRead}
                    disabled={markingAll}
                    title="Tandai semua telah dibaca"
                  >
                    {markingAll ? <Loader2 className="spin" size={13} /> : <CheckCheck size={13} />}
                    <span>Baca Semua</span>
                  </button>
                )}
                <button
                  type="button"
                  className="crm-notif-close-btn"
                  onClick={() => setIsOpen(false)}
                  aria-label="Tutup"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="crm-notif-tabs">
              <button
                type="button"
                className={`crm-notif-tab ${filter === "ALL" ? "active" : ""}`}
                onClick={() => setFilter("ALL")}
              >
                Semua ({items.length})
              </button>
              <button
                type="button"
                className={`crm-notif-tab ${filter === "UNREAD" ? "active" : ""}`}
                onClick={() => setFilter("UNREAD")}
              >
                Belum Dibaca ({unreadCount})
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="crm-notif-body">
            {loading ? (
              <div className="crm-notif-loading">
                <Loader2 className="spin" size={20} />
                <span>Memuat notifikasi...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="crm-notif-empty">
                <div className="crm-notif-empty-icon">
                  <Bell size={28} />
                </div>
                <b>Tidak ada notifikasi</b>
                <p>
                  {filter === "UNREAD"
                    ? "Semua notifikasi penting telah Anda baca."
                    : "Pemberitahuan jadwal tayang, approval, dan status akun akan muncul di sini."}
                </p>
              </div>
            ) : (
              <div className="crm-notif-list">
                {filteredItems.map((item) => {
                  const { icon: Icon, tone } = getNotificationIcon(item.kind);
                  const isUnread = !item.readAt;

                  return (
                    <div
                      key={item.id}
                      className={`crm-notif-item ${isUnread ? "unread" : ""} ${item.actionUrl ? "clickable" : ""}`}
                      onClick={() => markAsRead(item)}
                    >
                      <div className={`crm-notif-item-icon ${tone}`}>
                        <Icon size={16} />
                      </div>

                      <div className="crm-notif-item-content">
                        <div className="crm-notif-item-header">
                          <b className="crm-notif-item-title">{item.title}</b>
                          {isUnread && <span className="crm-notif-unread-dot" />}
                        </div>
                        <p className="crm-notif-item-body">{item.body}</p>
                        <div className="crm-notif-item-footer">
                          <span className="crm-notif-time">{timeAgo(item.createdAt)}</span>
                          {item.actionUrl && (
                            <span className="crm-notif-link-hint">
                              <span>Lihat</span>
                              <ChevronRight size={12} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="crm-notif-footer">
            <Link
              href="/settings/notifications"
              className="crm-notif-settings-link"
              onClick={() => setIsOpen(false)}
            >
              <Settings size={13} />
              <span>Pengaturan Notifikasi</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
