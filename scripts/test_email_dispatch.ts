import "dotenv/config";
import { sendPublishEmail } from "../apps/worker/src/email";

async function main() {
  console.log("=== Testing Real Email Dispatch ===");
  console.log(`SMTP_URL: ${process.env.SMTP_URL}`);
  console.log(`EMAIL_FROM: ${process.env.EMAIL_FROM}`);

  const success = await sendPublishEmail({
    toEmail: "ibnusoffyan@gmail.com",
    userName: "Ibnu Soffyan",
    channel: "YOUTUBE",
    accountName: "@ibnusoffyantsauri3834",
    caption: "🚀 Menguji notifikasi email otomatis publikasi konten YouTube Shorts dengan Routie CRM SaaS!",
    externalUrl: "https://youtube.com/shorts/vhL6MIde6yY",
    status: "SUCCEEDED",
    scheduledTime: new Date()
  });

  if (success) {
    console.log("✅ Email successfully delivered to SMTP!");
    console.log("👉 Buka Mailpit webmail di http://localhost:8025 untuk melihat preview email HTML-nya!");
  } else {
    console.error("❌ Failed to send email");
  }
}

main().catch(console.error);
