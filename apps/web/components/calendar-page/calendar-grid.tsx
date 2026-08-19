"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Zap
} from "lucide-react";
import type { CalendarConceptItem } from "@/app/api/calendar/route";
import { CalendarBuilder } from "@/components/calendar-builder";
import { ContentDetailModal } from "./content-detail-modal";
import { CreateContentModal } from "./create-content-modal";
import { DayDrawer } from "./day-drawer";

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const fullDayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

interface CalendarData {
  year: number;
  month: number;
  summary: {
    total: number;
    ready: number;
    draft: number;
    review: number;
    ideaReview?: number | undefined;
    finalReview?: number | undefined;
    generating: number;
    published: number;
    rejected: number;
  };
  days: Record<string, CalendarConceptItem[]>;
  concepts: CalendarConceptItem[];
}

export function CalendarGrid() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");

  // Modals & Drawers
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<CalendarConceptItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<string | undefined>(undefined);

  // Fetch calendar data
  async function fetchCalendar(year: number, month: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
      if (res.ok) {
        const data = (await res.json()) as CalendarData;
        setCalendarData(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCalendar(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Navigation handlers
  function handlePrevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleToday() {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  }

  // Month Title Label
  const monthTitle = useMemo(() => {
    const dateObj = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    return new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(dateObj);
  }, [currentYear, currentMonth]);

  // Filter concepts
  const filteredConcepts = useMemo(() => {
    if (!calendarData?.concepts) return [];
    return calendarData.concepts.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTopic = c.topic.toLowerCase().includes(q);
        const matchCaption = c.initialCaption.toLowerCase().includes(q);
        const matchHashtags = (c.hashtags || []).some((h) => h.toLowerCase().includes(q));
        if (!matchTopic && !matchCaption && !matchHashtags) return false;
      }
      // Platform
      if (platformFilter !== "ALL") {
        if (!c.channels.includes(platformFilter)) return false;
      }
      // Status
      if (statusFilter !== "ALL") {
        if (statusFilter === "READY" && !["APPROVED", "SCHEDULED"].includes(c.state)) return false;
        if (statusFilter === "DRAFT" && c.state !== "IDEA_DRAFT") return false;
        if (statusFilter === "IDEA_REVIEW" && c.state !== "IDEA_REVIEW") return false;
        if (statusFilter === "FINAL_REVIEW" && c.state !== "FINAL_REVIEW") return false;
        if (statusFilter === "REVIEW" && !["IDEA_REVIEW", "FINAL_REVIEW"].includes(c.state)) return false;
        if (statusFilter === "GENERATING" && !["IDEA_APPROVED", "GENERATING"].includes(c.state)) return false;
        if (statusFilter === "PUBLISHED" && c.state !== "PUBLISHED") return false;
      }
      // Format
      if (formatFilter !== "ALL") {
        if (c.recommendedKind !== formatFilter) return false;
      }
      return true;
    });
  }, [calendarData, searchQuery, platformFilter, statusFilter, formatFilter]);

  // Group filtered concepts by date
  const filteredDaysMap = useMemo(() => {
    const map: Record<string, CalendarConceptItem[]> = {};
    for (const c of filteredConcepts) {
      if (!map[c.localDate]) map[c.localDate] = [];
      map[c.localDate]!.push(c);
    }
    return map;
  }, [filteredConcepts]);

  // Grid Days Calculation (including padding from prev and next month)
  const gridCells = useMemo(() => {
    const firstDayIndex = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay(); // 0 (Sun) to 6 (Sat)
    const daysInCurrentMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 0)).getUTCDate();

    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // 1. Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr
      });
    }

    // 2. Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }

    // 3. Next month padding days to complete 35 or 42 cells (7 columns)
    const totalCells = Math.ceil(cells.length / 7) * 7;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr
      });
    }

    return cells;
  }, [currentYear, currentMonth, today]);

  // Helper for mini status pill inside cell
  function getStatusDotColor(state: string) {
    switch (state) {
      case "APPROVED":
      case "SCHEDULED":
        return "green";
      case "PUBLISHED":
        return "indigo";
      case "FINAL_REVIEW":
        return "orange";
      case "IDEA_REVIEW":
        return "amber";
      case "IDEA_APPROVED":
      case "GENERATING":
        return "purple";
      case "REJECTED":
      case "HELD":
      case "FAILED":
        return "red";
      case "IDEA_DRAFT":
      default:
        return "gray";
    }
  }

  return (
    <div className="crm-calendar-planner-wrapper">
      {/* Calendar Header Control Bar */}
      <div className="crm-calendar-control-bar">
        {/* Left: Navigation & Current Month */}
        <div className="crm-cal-nav-left">
          <div className="crm-cal-btn-group">
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-cal-nav-btn"
              onClick={handlePrevMonth}
              title="Bulan Sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-cal-today-btn"
              onClick={handleToday}
            >
              Hari Ini
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-cal-nav-btn"
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 className="crm-calendar-month-title">{monthTitle}</h2>
          {loading && <Loader2 className="spin crm-cal-spinner" size={16} />}
        </div>

        {/* Right: Actions */}
        <div className="crm-cal-actions-right">
          <button
            type="button"
            className="crm-btn crm-btn-primary"
            onClick={() => {
              setCreateModalDate(undefined);
              setCreateModalOpen(true);
            }}
          >
            <Plus size={16} />
            <span>+ Buat Konten</span>
          </button>

          <CalendarBuilder />
        </div>
      </div>

      {/* Summary Stat Badges */}
      <div className="crm-calendar-summary-bar">
        <div className="crm-cal-summary-item">
          <span className="crm-cal-stat-label">Total Jadwal</span>
          <b className="crm-cal-stat-num">{calendarData?.summary?.total ?? 0}</b>
        </div>
        <div className="crm-cal-summary-divider" />
        <div className="crm-cal-summary-item">
          <span className="crm-cal-stat-label green">
            <span className="crm-status-dot green" />
            Ready to Publish
          </span>
          <b className="crm-cal-stat-num green">{calendarData?.summary?.ready ?? 0}</b>
        </div>
        <div className="crm-cal-summary-item">
          <span className="crm-cal-stat-label amber">
            <span className="crm-status-dot amber" />
            Review Ide
          </span>
          <b className="crm-cal-stat-num amber">{calendarData?.summary?.ideaReview ?? calendarData?.summary?.review ?? 0}</b>
        </div>
        <div className="crm-cal-summary-item">
          <span className="crm-cal-stat-label orange">
            <span className="crm-status-dot orange" />
            Approval Konten
          </span>
          <b className="crm-cal-stat-num orange" style={{ color: "#C2410C", background: "#FFF7ED", borderColor: "#FED7AA" }}>
            {calendarData?.summary?.finalReview ?? 0}
          </b>
        </div>
        <div className="crm-cal-summary-item">
          <span className="crm-cal-stat-label purple">
            <span className="crm-status-dot purple" />
            Sedang Generate
          </span>
          <b className="crm-cal-stat-num purple">{calendarData?.summary?.generating ?? 0}</b>
        </div>
        <div className="crm-cal-summary-item">
          <span className="crm-cal-stat-label gray">
            <span className="crm-status-dot gray" />
            Draft Ide
          </span>
          <b className="crm-cal-stat-num gray">{calendarData?.summary?.draft ?? 0}</b>
        </div>
        <div className="crm-cal-summary-item">
          <span className="crm-cal-stat-label indigo">
            <span className="crm-status-dot indigo" />
            Published
          </span>
          <b className="crm-cal-stat-num indigo">{calendarData?.summary?.published ?? 0}</b>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="crm-calendar-filter-bar">
        <div className="crm-cal-search-wrap">
          <Search size={14} className="crm-cal-search-icon" />
          <input
            type="text"
            placeholder="Cari judul konten, caption, atau hashtag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="crm-cal-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="crm-cal-search-clear"
              onClick={() => setSearchQuery("")}
            >
              ×
            </button>
          )}
        </div>

        <div className="crm-cal-filter-selects">
          <div className="crm-cal-select-group">
            <span className="crm-cal-filter-lbl">Platform:</span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="crm-cal-select"
            >
              <option value="ALL">Semua Platform</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="TIKTOK">TikTok</option>
              <option value="THREADS">Threads</option>
              <option value="YOUTUBE">YouTube</option>
              <option value="X">X (Twitter)</option>
            </select>
          </div>

          <div className="crm-cal-select-group">
            <span className="crm-cal-filter-lbl">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="crm-cal-select"
            >
              <option value="ALL">Semua Status</option>
              <option value="READY">🟢 Ready to Publish</option>
              <option value="IDEA_REVIEW">🟡 Perlu Review Ide (Teks)</option>
              <option value="FINAL_REVIEW">🟠 Perlu Approval Konten (Visual)</option>
              <option value="GENERATING">🟣 Sedang Generate</option>
              <option value="DRAFT">⚪ Draft Ide</option>
              <option value="PUBLISHED">🔵 Published</option>
            </select>
          </div>

          <div className="crm-cal-select-group">
            <span className="crm-cal-filter-lbl">Format:</span>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="crm-cal-select"
            >
              <option value="ALL">Semua Format</option>
              <option value="IMAGE">Post Feed (1:1)</option>
              <option value="CAROUSEL">Carousel Slide</option>
              <option value="SHORT_VIDEO">Reels / Shorts</option>
              <option value="STORY">Story Vertikal (9:16)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Monthly Calendar Table */}
      <div className="crm-calendar-month-container">
        {/* Day Header Row */}
        <div className="crm-cal-days-header">
          {dayNames.map((d, index) => (
            <div key={d} className="crm-cal-day-col-title">
              <span className="crm-cal-day-short">{d}</span>
              <span className="crm-cal-day-full">{fullDayNames[index]}</span>
            </div>
          ))}
        </div>

        {/* Calendar Grid Cells */}
        <div className="crm-cal-month-grid">
          {gridCells.map((cell) => {
            const dayItems = filteredDaysMap[cell.dateStr] || [];
            const hasItems = dayItems.length > 0;
            const maxVisible = 3;
            const visibleItems = dayItems.slice(0, maxVisible);
            const extraCount = dayItems.length - maxVisible;

            return (
              <div
                key={cell.dateStr}
                className={`crm-cal-day-cell ${cell.isCurrentMonth ? "in-month" : "out-month"} ${
                  cell.isToday ? "is-today" : ""
                } ${hasItems ? "has-content" : ""}`}
                onClick={() => setSelectedDate(cell.dateStr)}
              >
                {/* Cell Header */}
                <div className="crm-cal-cell-header">
                  <span className={`crm-cal-day-number ${cell.isToday ? "today-badge" : ""}`}>
                    {cell.dayNumber}
                  </span>
                  {hasItems && (
                    <span className="crm-cal-cell-item-count">
                      {dayItems.length}
                    </span>
                  )}
                </div>

                {/* Compact Content Items List (Status + Time) */}
                <div className="crm-cal-cell-items-list">
                  {visibleItems.map((item) => {
                    const dotColor = getStatusDotColor(item.state);
                    return (
                      <div
                        key={item.id}
                        className={`crm-cal-content-pill compact ${dotColor}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConcept(item);
                        }}
                        title={`${item.localTime} WIB • ${item.topic}`}
                      >
                        <span className={`crm-pill-status-dot ${dotColor}`} />
                        <span className="crm-pill-time">{item.localTime} WIB</span>
                      </div>
                    );
                  })}

                  {extraCount > 0 && (
                    <div className="crm-cal-more-indicator">
                      +{extraCount} jadwal lagi
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Drawer */}
      {selectedDate && (
        <DayDrawer
          date={selectedDate}
          concepts={filteredDaysMap[selectedDate] || []}
          onClose={() => setSelectedDate(null)}
          onSelectConcept={(concept) => setSelectedConcept(concept)}
          onCreateContentForDate={(date) => {
            setSelectedDate(null);
            setCreateModalDate(date);
            setCreateModalOpen(true);
          }}
        />
      )}

      {/* Content Detail Modal */}
      {selectedConcept && (
        <ContentDetailModal
          concept={selectedConcept}
          onClose={() => setSelectedConcept(null)}
          onRefresh={() => fetchCalendar(currentYear, currentMonth)}
        />
      )}

      {/* Create Content Modal */}
      {createModalOpen && (
        <CreateContentModal
          initialDate={createModalDate}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => fetchCalendar(currentYear, currentMonth)}
        />
      )}
    </div>
  );
}
