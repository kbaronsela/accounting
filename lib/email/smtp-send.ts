import "server-only";

import nodemailer from "nodemailer";
import { getEmailSenderDisplayName } from "@/lib/email/email-sender-display-name";

export function isTransactionalEmailConfigured(): boolean {
  const addr = process.env.EMAIL_FROM_ADDRESS?.trim();
  const host = process.env.SMTP_HOST?.trim();
  return !!(addr && host);
}

/**
 * שליחת מייל טקסט דרך SMTP. אם אין הגדרה או שנכשלה השליחה — רושמים ללוג ולא זורקים.
 */
export async function sendTransactionalTextEmailSafe(input: {
  to: string;
  subject: string;
  textBody: string;
}): Promise<void> {
  if (!isTransactionalEmailConfigured()) {
    console.warn(
      "[email] דוא״ל לא מוגדר: חסרים EMAIL_FROM_ADDRESS או SMTP_HOST — ההזמנה נוצרה בלי משלוח מייל.",
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
      `[email] נשלחה הזמנה ל-${input.to} (${input.subject.slice(0, 48)}…)`,
    );
  } catch (err) {
    console.error("[email] שליחת מייל הזמנה נכשלה:", err);
  }
}
