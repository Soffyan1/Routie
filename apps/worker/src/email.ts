import nodemailer from "nodemailer";

export interface PublishNotificationEmailData {
  toEmail: string;
  userName: string;
  channel: string;
  accountName?: string | null | undefined;
  caption: string;
  externalUrl?: string | null | undefined;
  status: "SUCCEEDED" | "FAILED";
  errorMessage?: string | null | undefined;
  scheduledTime?: Date | null | undefined;
}

export async function sendPublishEmail(data: PublishNotificationEmailData): Promise<boolean> {
  const smtpUrl = process.env.SMTP_URL;
  if (!smtpUrl) {
    console.info(`[Email] SMTP_URL is not configured. Skipped sending email to ${data.toEmail}`);
    return false;
  }

  const isSuccess = data.status === "SUCCEEDED";
  const channelFormatted = data.channel.toUpperCase();
  const subject = isSuccess
    ? `🎉 Konten Anda Berhasil Terbit di ${channelFormatted}!`
    : `⚠️ Gagal Menerbitkan Konten ke ${channelFormatted}`;

  const fromAddress = process.env.EMAIL_FROM || "Routie <noreply@routie.local>";

  const transporter = nodemailer.createTransport(smtpUrl);

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      margin: 0;
      padding: 24px;
      color: #101828;
    }
    .email-container {
      max-width: 560px;
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
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
      background: ${isSuccess ? "#ECFDF3" : "#FEF3F2"};
      color: ${isSuccess ? "#067647" : "#B42318"};
      border: 1px solid ${isSuccess ? "#ABEFC6" : "#FECDCA"};
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
      margin-bottom: 20px;
    }
    .info-card {
      background: #F8FAFC;
      border: 1px solid #EAECF0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      border-bottom: 1px solid #F1F5F9;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #667085;
      font-weight: 500;
    }
    .info-value {
      color: #101828;
      font-weight: 600;
      text-align: right;
    }
    .caption-box {
      background: #FFFFFF;
      border: 1px solid #EAECF0;
      border-radius: 6px;
      padding: 12px;
      margin-top: 10px;
      font-size: 13px;
      color: #344054;
      line-height: 1.5;
      font-style: italic;
    }
    .cta-button {
      display: block;
      width: 100%;
      text-align: center;
      background: #4F46E5;
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 20px;
      box-sizing: border-box;
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
      <div class="brand-name">Routie — Content Automation</div>
    </div>
    
    <div class="email-body">
      <div class="status-badge">
        ${isSuccess ? "✓ Publikasi Berhasil" : "✕ Publikasi Gagal"}
      </div>
      
      <div class="greeting">Halo, ${data.userName}!</div>
      
      <p class="message">
        ${
          isSuccess
            ? `Postingan otomatis Anda telah berhasil diunggah ke <b>${channelFormatted}</b> sesuai jadwal perencanaan konten Routie.`
            : `Terjadi kendala saat worker mencoba menerbitkan postingan otomatis Anda ke <b>${channelFormatted}</b>.`
        }
      </p>
      
      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Channel Tujuan</span>
          <span class="info-value">${channelFormatted} ${data.accountName ? `(${data.accountName})` : ""}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status</span>
          <span class="info-value" style="color: ${isSuccess ? "#067647" : "#B42318"}">${data.status}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Waktu Tayang</span>
          <span class="info-value">${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</span>
        </div>
        ${
          data.errorMessage
            ? `
        <div class="info-row">
          <span class="info-label">Pesan Error</span>
          <span class="info-value" style="color: #B42318">${data.errorMessage}</span>
        </div>`
            : ""
        }
        
        <div style="margin-top: 10px;">
          <span class="info-label" style="font-size: 12px;">Caption / Deskripsi:</span>
          <div class="caption-box">${data.caption || "(Tanpa Caption)"}</div>
        </div>
      </div>
      
      ${
        isSuccess && data.externalUrl
          ? `<a href="${data.externalUrl}" class="cta-button" target="_blank">Lihat Postingan di ${channelFormatted} ↗</a>`
          : `<a href="${process.env.APP_URL || "http://localhost:3000"}/calendar" class="cta-button" target="_blank">Buka Kalender Konten Routie ↗</a>`
      }
    </div>
    
    <div class="email-footer">
      Email ini dikirim otomatis oleh <b>Routie CRM SaaS</b> karena Anda mengaktifkan notifikasi email.<br>
      Anda dapat menyesuaikan preferensi notifikasi kapan saja di menu <a href="${process.env.APP_URL || "http://localhost:3000"}/settings/notifications" style="color: #4F46E5;">Pengaturan Notifikasi</a>.
    </div>
  </div>
</body>
</html>
`;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: data.toEmail,
      subject,
      text: `${subject}\n\nChannel: ${channelFormatted}\nStatus: ${data.status}\nCaption: ${data.caption}\n${data.externalUrl ? `Link: ${data.externalUrl}` : ""}`,
      html
    });
    console.info(`[Email] Notification sent to ${data.toEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send notification email to ${data.toEmail}:`, error);
    return false;
  }
}
