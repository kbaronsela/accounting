import "server-only";

import nodemailer from "nodemailer";
import { getEmailSenderDisplayName } from "@/lib/email/email-sender-display-name";

export function isSmtpTransactionalConfigured(): boolean {
  const addr = process.env.EMAIL_FROM_ADDRESS?.trim();
  const host = process.env.SMTP_HOST?.trim();
  return !!(addr && host);
}

/**
 * SMTP — ברילווייא Free/Hobby יציאה לפורט 587 חסומה (timeout). בשימוש VPS/מחשב מקומי.
 */
export async function sendTransactionalTextEmailViaSmtpSafe(input: {
  to: string;
  subject: string;
  textBody: string;
}): Promise<void> {
  if (!isSmtpTransactionalConfigured()) {
    console.warn(
      "[email] SMTP לא מוגדר: חסרים EMAIL_FROM_ADDRESS או SMTP_HOST.",
    );
    return;
  }

  const fromAddr = process.env.EMAIL_FROM_ADDRESS!.trim();
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT || "587");
  const secureExplicit =
    process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true";
  const secure = secureExplicit || port === 465;
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASSWORD ?? "";

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: user.length > 0 || pass.trim().length > 0 ? { user, pass } : undefined,
    });
    await transporter.sendMail({
      from: {
        name: getEmailSenderDisplayName(),
        address: fromAddr,
      },
      to: input.to,
      subject: input.subject,
      text: input.textBody,
    });
    console.info(
      `[email] נשלח SMTP ל-${input.to} (${input.subject.slice(0, 48)}…)`,
    );
  } catch (err) {
    console.error("[email] שליחת מייל הזמנה (SMTP) נכשלה:", err);
  }
}
