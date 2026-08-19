import { CalendarDays, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CalendarGrid } from "@/components/calendar-page/calendar-grid";

export default function CalendarPage() {
  return (
    <AppShell active="Calendar">
      <div className="crm-page-container crm-calendar-page-container">
        {/* Page Header */}
        <section className="crm-page-header">
          <div className="crm-header-info">
            <span className="crm-header-date">CONTENT PUBLISHING PLANNER</span>
            <h1 className="crm-page-title">Kalender Konten Media Sosial</h1>
            <p className="crm-page-desc">
              Pusat kendali perencanaan konten bulanan. Kelola draf ide, review visual, dan pantau status jadwal tayang setiap hari.
            </p>
          </div>
        </section>

        {/* Full-Page Calendar Grid */}
        <section className="crm-card crm-calendar-card-section">
          <CalendarGrid />
        </section>
      </div>
    </AppShell>
  );
}
