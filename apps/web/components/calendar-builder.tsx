"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  Globe,
  Info,
  Layers,
  Loader2,
  Sparkles,
  X
} from "lucide-react";

const channels = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "THREADS", "YOUTUBE", "X"] as const;
const channelLabels: Record<(typeof channels)[number], string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  THREADS: "Threads",
  YOUTUBE: "YouTube Shorts",
  X: "X (Export Manual)"
};
const defaultTimes = ["09:00", "13:00", "19:00"];

function monthValue(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "numeric"
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year!, month! - 1, 1)));
}

export function CalendarBuilder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => monthValue(1));
  const [conceptsPerDay, setConceptsPerDay] = useState(1);
  const [times, setTimes] = useState(defaultTimes);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([...channels]);
  const [useWebSearch, setUseWebSearch] = useState(false);

  const estimate = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate() * conceptsPerDay;
  }, [month, conceptsPerDay]);

  function toggleChannel(channel: string) {
    setSelectedChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]
    );
  }

  async function createCalendar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const [year, monthNumber] = month.split("-").map(Number);
    try {
      const response = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month: monthNumber,
          conceptsPerDay,
          timezone: "Asia/Jakarta",
          times: times.slice(0, conceptsPerDay),
          channels: selectedChannels,
          useWebSearch
        })
      });
      const payload = (await response.json()) as {
        slotsCreated?: number;
        message?: string;
        issues?: Array<{ message?: string }>;
      };
      if (!response.ok)
        throw new Error(payload.message ?? payload.issues?.[0]?.message ?? "Kalender gagal dibuat");
      setMessage(`${payload.slotsCreated ?? estimate} konsep ${monthLabel(month)} sedang dibuat oleh AI.`);
      setOpen(false);
      router.refresh();
      window.setTimeout(() => router.refresh(), 4_000);
      window.setTimeout(() => router.refresh(), 12_000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan saat membuat kalender");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="crm-calendar-builder-wrapper" id="calendar">
      <button
        type="button"
        className="crm-btn crm-btn-primary"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <CalendarPlus size={16} />
        <span>Buat Kalender Konten</span>
      </button>

      {message && (
        <div className="crm-builder-success-msg">
          <Check size={14} />
          <span>{message}</span>
        </div>
      )}

      {open && (
        <div
          className="crm-modal-backdrop"
          role="presentation"
          onMouseDown={() => !loading && setOpen(false)}
        >
          <div
            className="crm-modal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <header className="crm-modal-header">
              <div className="crm-modal-icon-wrap">
                <CalendarPlus size={20} />
              </div>
              <div className="crm-modal-title-wrap">
                <span className="crm-modal-eyebrow">AI CONTENT PLANNER</span>
                <h2 id="calendar-modal-title" className="crm-modal-title">
                  Buat Kalender Konten Bulanan
                </h2>
                <p className="crm-modal-desc">
                  Routie akan membuat konsep harian otomatis dan mengadaptasikannya ke channel pilihan.
                </p>
              </div>
              <button
                type="button"
                className="crm-modal-close-btn"
                aria-label="Tutup"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                <X size={18} />
              </button>
            </header>

            {/* Modal Form Body */}
            <form onSubmit={createCalendar} className="crm-modal-form">
              {/* Row 1: Month & Count */}
              <div className="crm-form-grid-2">
                <div className="crm-form-group">
                  <label className="crm-label">Bulan Konten</label>
                  <input
                    type="month"
                    min={monthValue()}
                    value={month}
                    className="crm-input"
                    onChange={(e) => setMonth(e.target.value)}
                    required
                  />
                  <span className="crm-field-hint">Default bulan depan untuk mencegah jadwal lampau.</span>
                </div>

                <div className="crm-form-group">
                  <label className="crm-label">Frekuensi Ide per Hari</label>
                  <select
                    value={conceptsPerDay}
                    className="crm-select"
                    onChange={(e) => setConceptsPerDay(Number(e.target.value))}
                  >
                    <option value={1}>1 konsep per hari</option>
                    <option value={2}>2 konsep per hari</option>
                    <option value={3}>3 konsep per hari (Maksimal)</option>
                  </select>
                  <span className="crm-field-hint">Paket Routie mendukung hingga 3 konsep / hari.</span>
                </div>
              </div>

              {/* Row 2: Posting Times */}
              <div className="crm-form-group">
                <label className="crm-label">Jam Posting Terjadwal (WIB / Asia/Jakarta)</label>
                <div className="crm-times-grid">
                  {times.slice(0, conceptsPerDay).map((time, index) => (
                    <div key={index} className="crm-time-slot">
                      <span className="crm-slot-lbl">Slot #{index + 1}</span>
                      <input
                        type="time"
                        value={time}
                        className="crm-input"
                        onChange={(e) =>
                          setTimes((curr) =>
                            curr.map((item, i) => (i === index ? e.target.value : item))
                          )
                        }
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3: Target Social Channels Selection */}
              <div className="crm-form-group">
                <label className="crm-label">Channel Publikasi Tujuan</label>
                <div className="crm-channel-tiles-grid">
                  {channels.map((channel) => {
                    const isSelected = selectedChannels.includes(channel);
                    return (
                      <button
                        key={channel}
                        type="button"
                        className={`crm-channel-tile ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleChannel(channel)}
                      >
                        <div className="crm-tile-checkbox">
                          {isSelected && <Check size={12} />}
                        </div>
                        <span className="crm-tile-name">{channelLabels[channel]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Gemini Web Search Option */}
              <div className="crm-feature-toggle-card">
                <input
                  id="webSearchToggle"
                  type="checkbox"
                  checked={useWebSearch}
                  onChange={(e) => setUseWebSearch(e.target.checked)}
                />
                <label htmlFor="webSearchToggle">
                  <div className="crm-toggle-info">
                    <span className="crm-toggle-title">Gunakan Riset Web Realtime (Gemini Grounding)</span>
                    <span className="crm-toggle-desc">
                      Menambahkan rujukan tren dan data aktual dari Google Search ke dalam ide konten.
                    </span>
                  </div>
                </label>
              </div>

              {/* Generation Summary Box */}
              <div className="crm-estimate-banner">
                <Sparkles size={18} className="crm-estimate-icon" />
                <div className="crm-estimate-text">
                  <b>{estimate} konsep konten akan dibuat</b>
                  <span>
                    {conceptsPerDay} konsep/hari × hari di bulan {monthLabel(month)}. Menggunakan kuota API Gemini milikmu.
                  </span>
                </div>
              </div>

              {error && (
                <div className="crm-alert-toast error" role="alert" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Info size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                  {error.includes("Pengaturan") && (
                    <a
                      href="/settings"
                      className="crm-btn crm-btn-secondary"
                      style={{ fontSize: "11.5px", padding: "3px 10px", marginTop: "2px" }}
                    >
                      Buka Menu Pengaturan →
                    </a>
                  )}
                </div>
              )}

              {/* Modal Footer Actions */}
              <footer className="crm-modal-footer">
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="crm-btn crm-btn-primary"
                  disabled={loading || selectedChannels.length === 0}
                >
                  {loading ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
                  <span>{loading ? "Memproses Kalender..." : `Buat ${estimate} Konsep`}</span>
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
