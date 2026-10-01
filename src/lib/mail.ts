import "server-only";
import nodemailer from "nodemailer";

export async function sendMail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_URL) {
    console.log(`[mail] (SMTP_URL not set) to=${to} subject=${subject}\n${text}`);
    return;
  }
  const transport = nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
}
