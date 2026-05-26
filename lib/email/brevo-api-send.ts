import "server-only";

import { getEmailSenderDisplayName } from "@/lib/email/email-sender-display-name";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

function brevoApiKey(): string | null {
  const k =
    process.env.BREVO_API_KEY?.trim() ||
    process.env.SENDINBLUE_API_KEY?.trim() ||
    "";
  return k.length > 0 ? k : null;
}

export function isBrevoApiConfigured(): boolean {
  return brevoApiKey() !== null;
}

/**
 * שליחה דרך HTTPS (פורט 443) — עובד ב-Railway וסביבות שחוסמות יציאה ל-SMTP.
 * @see https://developers.brevo.com/reference/sendtransacemail
 */
export async function sendViaBrevoApiSafe(input: {
  to: string;
  subject: string;
  textBody: string;
}): Promise<void> {
  const apiKey = brevoApiKey();
  const fromAddr = process.env.EMAIL_FROM_ADDRESS?.trim();
  if (!apiKey || !fromAddr) {
    console.warn(
      "[email] Brevo API: חסרים BREVO_API_KEY או EMAIL_FROM_ADDRESS",
    );
    return;
  }

  try {
    const res = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: getEmailSenderDisplayName(),
          email: fromAddr,
        },
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.textBody,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Brevo HTTP ${res.status}: ${detail.slice(0, 500)}`);
    }

    console.info(
      `[email] נשלח דרך Brevo ל-${input.to} (${input.subject.slice(0, 48)}…)`,
    );
  } catch (err) {
    console.error("[email] שליחת מייל דרך Brevo נכשלה:", err);
  }
}
