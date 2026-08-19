import Link from "next/link";
import { ArrowRight, CheckCircle2, Globe, Layers3, ShieldCheck, Sparkles, TrendingUp, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="crm-landing-page">
      {/* Top Navbar */}
      <header className="crm-landing-navbar">
        <div className="crm-landing-nav-inner">
          <Link href="/" className="crm-brand">
            <div className="crm-brand-logo">R</div>
            <div className="crm-brand-text">
              <span className="crm-brand-name">Routie</span>
              <span className="crm-brand-tag">CRM SaaS</span>
            </div>
          </Link>

          <nav className="crm-landing-links">
            <a href="#features">Fitur Utama</a>
            <a href="#preview">Dashboard Preview</a>
            <a href="#channels">Integrasi Channel</a>
          </nav>

          <div className="crm-landing-nav-cta">
            <Link href="/dashboard" className="crm-btn crm-btn-primary">
              <span>Buka Workspace</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="crm-landing-hero">
        <div className="crm-hero-badge">
          <Sparkles size={13} />
          <span>AI Content Operations Platform for Modern Brands</span>
        </div>

        <h1 className="crm-hero-title">
          Satu bulan konten brand.<br />
          <span className="crm-text-gradient">Direncanakan & terjadwal hari ini.</span>
        </h1>

        <p className="crm-hero-subtitle">
          Routie mengubah repositori identitas brand menjadi kalender konten otomatis berkapabilitas multi-channel, 
          memisahkan approval ide dan render media visual, lalu menerbitkan tepat waktu dengan BYOK API milikmu.
        </p>

        <div className="crm-hero-cta-group">
          <Link href="/dashboard" className="crm-btn crm-btn-primary large">
            <span>Masuk ke Dashboard</span>
            <ArrowRight size={16} />
          </Link>
          <Link href="/onboarding" className="crm-btn crm-btn-secondary large">
            <span>Alur Setup Onboarding</span>
          </Link>
        </div>

        <div className="crm-trust-badges">
          <div className="crm-trust-item">
            <ShieldCheck size={16} className="text-green" />
            <span>Envelope Encryption BYOK</span>
          </div>
          <div className="crm-trust-item">
            <CheckCircle2 size={16} className="text-blue" />
            <span>2-Stage Approval Gate</span>
          </div>
          <div className="crm-trust-item">
            <Layers3 size={16} className="text-purple" />
            <span>6 Channel Publikasi Aktif</span>
          </div>
        </div>
      </section>

      {/* Live Dashboard Mockup Window */}
      <section className="crm-landing-mockup-section" id="preview">
        <div className="crm-mockup-window">
          {/* Mockup Top Window Bar */}
          <div className="crm-mockup-window-header">
            <div className="crm-window-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <div className="crm-window-address">
              <span>https://app.routie.io/dashboard</span>
            </div>
          </div>

          {/* Mockup Dashboard Body */}
          <div className="crm-mockup-body">
            {/* Mini Sidebar */}
            <aside className="crm-mockup-sidebar">
              <div className="crm-mockup-brand">
                <div className="crm-brand-logo small">R</div>
                <span>Nusa Brew</span>
              </div>
              <div className="crm-mockup-nav">
                <div className="crm-mockup-nav-item active">Overview</div>
                <div className="crm-mockup-nav-item">Calendar</div>
                <div className="crm-mockup-nav-item">Approvals</div>
                <div className="crm-mockup-nav-item">Channels</div>
                <div className="crm-mockup-nav-item">Settings</div>
              </div>
            </aside>

            {/* Mockup Content View */}
            <main className="crm-mockup-main">
              <div className="crm-mockup-header-row">
                <div>
                  <span className="crm-mockup-date">Agustus 2026</span>
                  <h3 className="crm-mockup-title">Content Command Center</h3>
                </div>
                <span className="crm-status-pill green">
                  <span className="crm-status-dot" />
                  31 Terjadwal
                </span>
              </div>

              {/* 3 Metric Cards */}
              <div className="crm-mockup-metrics">
                <div className="crm-mockup-card">
                  <span className="lbl">Konsep Bulan Ini</span>
                  <b className="val">31</b>
                  <small className="sub text-green">100% kuota aktif</small>
                </div>
                <div className="crm-mockup-card">
                  <span className="lbl">Menunggu Approval</span>
                  <b className="val text-amber">08</b>
                  <small className="sub">3 butuh tindakan</small>
                </div>
                <div className="crm-mockup-card">
                  <span className="lbl">Siap Diterbitkan</span>
                  <b className="val text-blue">24</b>
                  <small className="sub">6 channel terhubung</small>
                </div>
              </div>

              {/* Workflow Step Bar */}
              <div className="crm-mockup-workflow">
                {[
                  { num: "01", title: "Ide & Riset AI", sub: "31 konsep terbuat" },
                  { num: "02", title: "Approval Ide", sub: "8 pending review" },
                  { num: "03", title: "Render Media", sub: "Worker otomasi" },
                  { num: "04", title: "Auto-Publish", sub: "Publishing queue" }
                ].map((st, i) => (
                  <div key={st.num} className="crm-workflow-node">
                    <span className="crm-node-num">{st.num}</span>
                    <div className="crm-node-text">
                      <b>{st.title}</b>
                      <small>{st.sub}</small>
                    </div>
                  </div>
                ))}
              </div>
            </main>
          </div>
        </div>
      </section>

      {/* Supported Channels Strip */}
      <section className="crm-landing-channels-strip" id="channels">
        <span className="crm-channels-heading">Adaptasi Sekali, Hadir di Seluruh Channel Sosial</span>
        <div className="crm-channels-badges-wrap">
          {["Instagram", "Facebook Page", "TikTok Direct", "Threads API", "YouTube Shorts", "X Manual Export"].map(
            (channel) => (
              <span key={channel} className="crm-channel-pill large">
                {channel}
              </span>
            )
          )}
        </div>
      </section>
    </div>
  );
}
