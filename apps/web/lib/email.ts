import nodemailer from "nodemailer";

export async function sendMagicLink(email: string, url: string, brandOrUserName?: string, kind: "LOGIN" | "TEAM_INVITE" = "LOGIN"): Promise<void> {
  const smtpUrl = process.env.SMTP_URL;
  if (!smtpUrl) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_URL is required in production");
    console.info(JSON.stringify({ level: "info", message: "Development magic link generated", email, url }));
    return;
  }
  const transporter = nodemailer.createTransport(smtpUrl);
  const fromAddress = process.env.EMAIL_FROM ?? "Routie <noreply@routie.local>";

  const nameGreeting = brandOrUserName ? `Halo, ${brandOrUserName}!` : "Halo!";
  const isTeamInvite = kind === "TEAM_INVITE";

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isTeamInvite ? "Undangan Workspace Routie" : "Tautan Masuk ke Routie Workspace"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      margin: 0;
      padding: 24px;
      color: #101828;
    }
    .email-container {
      max-width: 540px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 12px;
      border: 1px solid #EAECF0;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(16, 24, 40, 0.05);
    }
    .email-header {
      background: #4F46E5;
      padding: 24px;
      text-align: center;
      color: #FFFFFF;
    }
    .brand-logo {
      display: inline-block;
      width: 40px;
      height: 40px;
      line-height: 40px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      font-size: 20px;
      font-weight: 800;
      color: #FFFFFF;
      margin-bottom: 8px;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .email-body {
      padding: 28px 24px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #101828;
    }
    .message {
      font-size: 14px;
      line-height: 1.6;
      color: #475467;
      margin-bottom: 24px;
    }
    .cta-button {
      display: block;
      width: 100%;
      text-align: center;
      background: #4F46E5;
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 13px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
      box-sizing: border-box;
    }
    .security-note {
      background: #F8FAFC;
      border: 1px solid #EAECF0;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 12.5px;
      color: #667085;
      line-height: 1.5;
    }
    .email-footer {
      background: #F8FAFC;
      padding: 20px 24px;
      border-top: 1px solid #EAECF0;
      font-size: 12px;
      color: #667085;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="brand-logo">R</div>
      <div class="brand-name">Routie — Workspace Access</div>
    </div>
    
    <div class="email-body">
      <div class="greeting">${nameGreeting}</div>
      <p class="message">
        ${isTeamInvite ? "Anda diundang untuk bergabung ke workspace <b>Routie Content Automation</b>. Klik tombol di bawah untuk menerima undangan dan membuat akses Anda:" : "Klik tombol aman di bawah ini untuk langsung masuk ke workspace <b>Routie Content Automation</b> Anda tanpa perlu kata sandi:"}
      </p>
      
      <a href="${url}" class="cta-button" target="_blank">${isTeamInvite ? "Terima Undangan Workspace ↗" : "Masuk ke Workspace Routie ↗"}</a>
      
      <div class="security-note">
        🔒 <b>Penting:</b> Tautan masuk ini hanya berlaku selama <b>15 menit</b> dan hanya dapat digunakan satu kali. Jika Anda tidak merasa meminta tautan ini, abaikan email ini.
      </div>
    </div>
    
    <div class="email-footer">
      Email ini dikirim oleh <b>Routie CRM SaaS</b> (bagian dari ekosistem Mesin R1).<br>
      Jika tombol di atas tidak berfungsi, salin dan buka tautan berikut di browser Anda:<br>
      <span style="color: #4F46E5; word-break: break-all; font-size: 11px;">${url}</span>
    </div>
  </div>
</body>
</html>
`;

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject: isTeamInvite ? "✨ Undangan Bergabung ke Workspace Routie" : "✨ Tautan Masuk Aman ke Workspace Routie",
    text: `${isTeamInvite ? "Terima undangan workspace Routie" : "Klik tautan ini untuk langsung masuk ke workspace Routie Anda"} (berlaku 15 menit): ${url}`,
    html
  });
}
