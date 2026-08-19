"use client";

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  Layers,
  Plus,
  Sparkles,
  X
} from "lucide-react";
import type { CalendarConceptItem } from "@/app/api/calendar/route";

interface DayDrawerProps {
  date: string; // YYYY-MM-DD
  concepts: CalendarConceptItem[];
  onClose: () => void;
  onSelectConcept: (concept: CalendarConceptItem) => void;
  onCreateContentForDate: (date: string) => void;
}

function formatDateHeader(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(year!, month! - 1, day!));
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(dateObj);
}

function getStatusBadge(state: string) {
  switch (state) {
    case "APPROVED":
    case "SCHEDULED":
      return { label: "Ready to Publish", color: "green", dot: "green" };
    case "PUBLISHED":
      return { label: "Published", color: "indigo", dot: "indigo" };
    case "FINAL_REVIEW":
      return { label: "Perlu Approval Konten", color: "orange", dot: "orange" };
    case "IDEA_REVIEW":
      return { label: "Perlu Review Ide", color: "amber", dot: "amber" };
    case "IDEA_APPROVED":
    case "GENERATING":
      return { label: "Sedang Generate", color: "purple", dot: "purple" };
    case "REJECTED":
      return { label: "Ditolak", color: "red", dot: "red" };
    case "HELD":
    case "FAILED":
      return { label: "Perlu Revisi", color: "red", dot: "red" };
    case "IDEA_DRAFT":
    default:
      return { label: "Draft", color: "gray", dot: "gray" };
  }
}

export function DayDrawer({
  date,
  concepts,
  onClose,
  onSelectConcept,
  onCreateContentForDate
}: DayDrawerProps) {
  const formattedDate = formatDateHeader(date);
  const readyCount = concepts.filter((c) => ["APPROVED", "SCHEDULED"].includes(c.state)).length;
  const draftCount = concepts.filter((c) => ["IDEA_DRAFT", "IDEA_REVIEW"].includes(c.state)).length;
  const reviewCount = concepts.filter((c) => c.state === "FINAL_REVIEW").length;

  return (
    <div className="crm-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="crm-day-drawer"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <header className="crm-drawer-header">
          <div className="crm-drawer-title-box">
            <div className="crm-drawer-icon-wrap">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="crm-drawer-date-title">{formattedDate}</h3>
              <div className="crm-drawer-counts-row">
                <span className="crm-drawer-count-badge">
                  <b>{concepts.length}</b> total konten
                </span>
                {readyCount > 0 && (
                  <span className="crm-status-pill mini green">
                    <span className="crm-status-dot green" />
                    <span>{readyCount} Ready</span>
                  </span>
                )}
                {reviewCount > 0 && (
                  <span className="crm-status-pill mini amber">
                    <span className="crm-status-dot amber" />
                    <span>{reviewCount} Perlu Approval</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="crm-modal-close-btn"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content Items List */}
        <div className="crm-drawer-body">
          {concepts.length === 0 ? (
            <div className="crm-drawer-empty-state">
              <div className="crm-empty-icon-wrap">
                <Calendar size={32} />
              </div>
              <h4>Belum Ada Konten di Tanggal Ini</h4>
              <p>Jadwalkan postingan media sosial atau buat ide konten baru bersama AI.</p>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => onCreateContentForDate(date)}
                style={{ marginTop: "12px" }}
              >
                <Plus size={15} />
                <span>+ Buat Konten Tanggal Ini</span>
              </button>
            </div>
          ) : (
            <div className="crm-drawer-items-list">
              {concepts.map((concept) => {
                const status = getStatusBadge(concept.state);
                return (
                  <div
                    key={concept.id}
                    className="crm-drawer-card-item"
                    onClick={() => onSelectConcept(concept)}
                  >
                    {/* Thumbnail / Icon */}
                    <div className="crm-drawer-card-thumb">
                      {concept.mediaAsset?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={concept.mediaAsset.url}
                          alt={concept.topic}
                          className="crm-thumb-img"
                        />
                      ) : (
                        <div className="crm-thumb-placeholder">
                          <ImageIcon size={18} />
                        </div>
                      )}
                    </div>

                    {/* Main Info */}
                    <div className="crm-drawer-card-content">
                      <div className="crm-drawer-card-top">
                        <span className="crm-drawer-time">
                          <Clock size={12} />
                          <span>{concept.localTime} WIB</span>
                        </span>
                        <span className={`crm-status-pill mini ${status.color}`}>
                          <span className={`crm-status-dot ${status.dot}`} />
                          <span>{status.label}</span>
                        </span>
                      </div>

                      <b className="crm-drawer-card-topic">{concept.topic}</b>

                      {concept.initialCaption && (
                        <p className="crm-drawer-card-caption-preview">
                          {concept.initialCaption.slice(0, 90)}
                          {concept.initialCaption.length > 90 ? "..." : ""}
                        </p>
                      )}

                      <div className="crm-drawer-card-footer">
                        <div className="crm-drawer-platforms">
                          {concept.channels.map((ch) => (
                            <span key={ch} className="crm-platform-tag mini">
                              {ch}
                            </span>
                          ))}
                        </div>
                        <span className="crm-drawer-view-action">
                          <span>Detail</span>
                          <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {concepts.length > 0 && (
          <footer className="crm-drawer-footer">
            <button
              type="button"
              className="crm-btn crm-btn-primary full-width"
              onClick={() => onCreateContentForDate(date)}
            >
              <Plus size={15} />
              <span>+ Tambah Konten di Tanggal Ini</span>
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
