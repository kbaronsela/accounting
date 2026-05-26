export const DEFAULT_EMAIL_SENDER_DISPLAY_NAME = "מערכת שיתוף קבלות";

export function getEmailSenderDisplayName(): string {
  const raw = process.env.EMAIL_SENDER_DISPLAY_NAME?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_EMAIL_SENDER_DISPLAY_NAME;
}
