import nodemailer from "nodemailer";

export async function sendMagicLink(email: string, url: string): Promise<void> {
  const smtpUrl = process.env.SMTP_URL;
  if (!smtpUrl) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_URL is required in production");
    console.info(JSON.stringify({ level: "info", message: "Development magic link generated", email, url }));
    return;
  }
  const transporter = nodemailer.createTransport(smtpUrl);
  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "Routie <noreply@routie.local>",
    to: email,
    subject: "Masuk ke workspace Routie",
    text: `Klik tautan ini untuk masuk ke Routie. Tautan berlaku 15 menit: ${url}`,
    html: `<p>Klik tombol berikut untuk masuk ke Routie. Tautan berlaku 15 menit.</p><p><a href="${url}">Masuk ke Routie</a></p>`
  });
}
