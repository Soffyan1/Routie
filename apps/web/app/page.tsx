import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  KeyRound,
  Layers3,
  Mail,
  PlaySquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Video,
  Zap
} from "lucide-react";

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
              <span className="crm-brand-tag">Mesin R1 Ecosystem</span>
            </div>
          </Link>

          <nav className="crm-landing-links">
            <a href="#features">Fitur Unggulan</a>
            <a href="#how-it-works">Cara Kerja</a>
            <a href="#channels">Integrasi Channel</a>
            <a href="#r1-ecosystem">Mesin R1 Add-On</a>
          </nav>

          <div className="crm-landing-nav-cta">
            <Link href="/login" className="crm-btn crm-btn-secondary">
              <span>Masuk</span>
            </Link>
            <Link href="/signup" className="crm-btn crm-btn-primary">
              <span>Coba Gratis</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="crm-landing-hero">
        <div className="crm-hero-badge">
          <Sparkles size={14} />
          <span>AI Content Automation Platform • Ekosistem Mesin R1</span>
        </div>

        <h1 className="crm-hero-title">
          1 Bulan Konten Media Sosial.<br />
          <span className="crm-text-gradient">Direncanakan & Terbit Otomatis Hari Ini.</span>
        </h1>

        <p className="crm-hero-subtitle">
          Routie mengubah identitas brand Anda menjadi kalender konten otomatis berkapabilitas multi-channel. 
          Riset topik AI, approval draf 2 tahap, hingga publikasi terjadwal ke YouTube Shorts, Instagram, TikTok, Facebook, dan Threads.
        </p>

        <div className="crm-hero-cta-group">
          <Link href="/signup" className="crm-btn crm-btn-primary large">
            <span>Mulai Buat Konten Gratis</span>
            <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="crm-btn crm-btn-secondary large">
            <span>Masuk ke Workspace</span>
          </Link>
        </div>

        <div className="crm-trust-badges">
          <div className="crm-trust-item">
            <ShieldCheck size={16} className="text-green" />
            <span>Enkripsi BYOK AES-256 GCM</span>
          </div>
          <div className="crm-trust-item">
            <CheckCircle2 size={16} className="text-blue" />
            <span>2-Stage Approval Gate</span>
          </div>
          <div className="crm-trust-item">
            <Mail size={16} className="text-purple" />
            <span>Notifikasi Email Real-Time</span>
          </div>
          <div className="crm-trust-item">
            <Layers3 size={16} className="text-amber" />
            <span>Auto-Publish Multi-Channel</span>
          </div>
        </div>
      </section>

      {/* Mesin R1 Callout Banner */}
      <section className="crm-landing-section" id="r1-ecosystem" style={{ paddingTop: 0 }}>
        <div className="crm-r1-hero-banner">
          <div className="crm-r1-hero-left">
            <span className="crm-r1-eyebrow">OFFICIAL ADD-ON PRODUCT</span>
            <h3 className="crm-r1-heading">Produk Unggulan Tambahan untuk Pengguna Mesin R1</h3>
            <p className="crm-r1-desc">
              Telah terdaftar sebagai pengguna di <a href="https://mesinr1.com" target="_blank" rel="noreferrer" className="crm-r1-link">mesinr1.com <ExternalLink size={13} /></a>? 
              Admin Mesin R1 dapat mendaftarkan email bisnis Anda untuk langsung mengaktifkan workspace Routie tanpa biaya setup tambahan.
            </p>
          </div>
          <div className="crm-r1-hero-right">
            <Link href="/login" className="crm-btn crm-btn-primary">
              <span>Masuk via Akun R1 Anda &rarr;</span>
            </Link>
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
              <span>https://app.routie.io/calendar</span>
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
                <div className="crm-mockup-nav-item">Overview</div>
                <div className="crm-mockup-nav-item active">Calendar Planner</div>
                <div className="crm-mockup-nav-item">Approvals</div>
                <div className="crm-mockup-nav-item">Connectors</div>
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
                  31 Postingan Terjadwal
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
                  <b className="val text-amber">04</b>
                  <small className="sub">Siap direview</small>
                </div>
                <div className="crm-mockup-card">
                  <span className="lbl">Siap Diterbitkan</span>
                  <b className="val text-blue">27</b>
                  <small className="sub">YouTube, IG, TikTok</small>
                </div>
              </div>

              {/* Workflow Step Bar */}
              <div className="crm-mockup-workflow">
                {[
                  { num: "01", title: "Ide & Riset AI", sub: "Generate kalender sebulan" },
                  { num: "02", title: "Approval Ide", sub: "Review & sesuaikan caption" },
                  { num: "03", title: "Visual Render", sub: "Upload video / AI visual" },
                  { num: "04", title: "Auto-Publish", sub: "Terbit otomatis + Email notif" }
                ].map((st) => (
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

      {/* Feature Grid Section */}
      <section className="crm-landing-section" id="features">
        <div className="crm-landing-section-header">
          <span className="crm-section-eyebrow">FITUR UNGGULAN</span>
          <h2 className="crm-section-title">Semua yang Dibutuhkan untuk Mendominasi Konten Sosmed</h2>
          <p className="crm-section-subtitle">
            Dari perencanaan ide hingga eksekusi penerbitan, seluruh alur kerja dirancang untuk menghemat waktu Anda 10x lipat.
          </p>
        </div>

        <div className="crm-features-grid">
          <div className="crm-feature-card">
            <div className="crm-feature-icon-box indigo">
              <Calendar size={22} />
            </div>
            <h3 className="crm-feature-title">Kalender Konten 30 Hari Otomatis</h3>
            <p className="crm-feature-desc">
              Buat struktur rencana konten bulanan lengkap dengan topik, hook pembuka, caption engaging, dan hashtag relevan dalam 1 kali klik.
            </p>
          </div>

          <div className="crm-feature-card">
            <div className="crm-feature-icon-box red">
              <PlaySquare size={22} />
            </div>
            <h3 className="crm-feature-title">Auto-Publish YouTube Shorts</h3>
            <p className="crm-feature-desc">
              Unggah video pendek dari kalender, atur jadwal, dan worker otomatis mempublikasikan video ke channel YouTube Anda secara real-time.
            </p>
          </div>

          <div className="crm-feature-card">
            <div className="crm-feature-icon-box amber">
              <CheckCircle2 size={22} />
            </div>
            <h3 className="crm-feature-title">2-Stage Approval Gate</h3>
            <p className="crm-feature-desc">
              Kontrol penuh kualitas konten. Pisahkan tahap review naskah dan render media visual sebelum konten siap dipublikasikan ke publik.
            </p>
          </div>

          <div className="crm-feature-card">
            <div className="crm-feature-icon-box purple">
              <KeyRound size={22} />
            </div>
            <h3 className="crm-feature-title">BYOK (Bring Your Own Key) AI</h3>
            <p className="crm-feature-desc">
              Gunakan API key Google Gemini atau OpenAI milik Anda sendiri. Seluruh kredensial tersimpan dengan enkripsi amplop AES-256 GCM.
            </p>
          </div>

          <div className="crm-feature-card">
            <div className="crm-feature-icon-box green">
              <Mail size={22} />
            </div>
            <h3 className="crm-feature-title">Notifikasi Email & In-App Real-Time</h3>
            <p className="crm-feature-desc">
              Dapatkan email pemberitahuan instan di inbox Gmail Anda setiap kali konten berhasil tayang atau memerlukan review tim.
            </p>
          </div>

          <div className="crm-feature-card">
            <div className="crm-feature-icon-box blue">
              <Bot size={22} />
            </div>
            <h3 className="crm-feature-title">Brand Tone & Persona Konsisten</h3>
            <p className="crm-feature-desc">
              Ajari Routie bahasa dan karakter unik brand Anda. AI akan menulis konten yang selalu selaras dengan gaya komunikasi bisnis Anda.
            </p>
          </div>
        </div>
      </section>

      {/* Supported Channels Strip */}
      <section className="crm-landing-channels-strip" id="channels">
        <span className="crm-channels-heading">Terhubung dengan Ekosistem Media Sosial Terpopuler</span>
        <div className="crm-channels-badges-wrap">
          {["YouTube Shorts Direct", "Instagram Reels & Feed", "TikTok Direct Post", "Facebook Pages", "Threads API", "X (Twitter) Export"].map(
            (channel) => (
              <span key={channel} className="crm-channel-pill large">
                {channel}
              </span>
            )
          )}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="crm-landing-cta-section">
        <div className="crm-cta-box">
          <h2 className="crm-cta-title">Siap Mengotomasi Konten Media Sosial Brand Anda?</h2>
          <p className="crm-cta-subtitle">
            Daftar sekarang secara gratis atau masuk dengan akun yang telah didaftarkan oleh admin Mesin R1.
          </p>
          <div className="crm-cta-btn-group">
            <Link href="/signup" className="crm-btn crm-btn-primary large">
              <span>Daftar Akun Gratis</span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="crm-btn crm-btn-secondary large white">
              <span>Masuk ke Workspace</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Landing Footer */}
      <footer className="crm-landing-footer">
        <div className="crm-landing-footer-inner">
          <div className="crm-footer-brand-col">
            <div className="crm-brand">
              <div className="crm-brand-logo">R</div>
              <div className="crm-brand-text">
                <span className="crm-brand-name">Routie</span>
                <span className="crm-brand-tag">CRM SaaS</span>
              </div>
            </div>
            <p className="crm-footer-desc">
              Platform otomasi operasi konten media sosial multi-channel berbasis AI. Produk resmi nilai tambah ekosistem Mesin R1.
            </p>
          </div>

          <div className="crm-footer-links-col">
            <b>Navigasi Cepat</b>
            <Link href="/login">Masuk ke Akun</Link>
            <Link href="/signup">Daftar Workspace Baru</Link>
            <Link href="/onboarding">Setup Onboarding</Link>
            <a href="https://mesinr1.com" target="_blank" rel="noreferrer">Mesin R1 Official ↗</a>
          </div>

          <div className="crm-footer-links-col">
            <b>Keamanan & Privasi</b>
            <span>Envelope Encryption AES-256</span>
            <span>Zero Password Leak Risk</span>
            <span>BYOK Direct Privacy</span>
          </div>
        </div>

        <div className="crm-footer-bottom">
          <span>&copy; 2026 Routie CRM SaaS • Ekosistem Mesin R1. Seluruh hak cipta dilindungi.</span>
        </div>
      </footer>
    </div>
  );
}
