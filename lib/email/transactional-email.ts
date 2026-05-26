import "server-only";

import { isBrevoApiConfigured, sendViaBrevoApiSafe } from "@/lib/email/brevo-api-send";
import {
  isSmtpTransactionalConfigured,
  sendTransactionalTextEmailViaSmtpSafe,
} from "@/lib/email/smtp-send";

/** יש מסלול שליחה (Brevo HTTPS או SMTP) + כתובת שולח */
export function isTransactionalEmailConfigured(): boolean {
  const from = process.env.EMAIL_FROM_ADDRESS?.trim();
  if (!from) return false;
  return isBrevoApiConfigured() || isSmtpTransactionalConfigured();
}

/**
 * העדפת Brevo API (HTTPS) כשיש `BREVO_API_KEY` — נדרש ב-Railway Free/Hobby כי SMTP יוצא חסום.
 * אחרת SMTP מקומי / שרתים שמאשרים פורט 587.
 */
export async function sendTransactionalTextEmailSafe(input: {
  to: string;
  subject: string;
  textBody: string;
}): Promise<void> {
  const from = process.env.EMAIL_FROM_ADDRESS?.trim();
  if (!from) {
    console.warn(
      "[email] חסר EMAIL_FROM_ADDRESS — ההזמנה נוצרה בלי משלוח מייל.",
    );
    return;
  }

  if (isBrevoApiConfigured()) {
    await sendViaBrevoApiSafe(input);
    return;
  }

  if (isSmtpTransactionalConfigured()) {
    await sendTransactionalTextEmailViaSmtpSafe(input);
    return;
  }

  console.warn(
    "[email] דוא״ל לא מוגדר: הגדירו BREVO_API_KEY (מומלץ ב-Railway) או SMTP_HOST — ההזמנה נוצרה בלי מייל.",
  );
}
