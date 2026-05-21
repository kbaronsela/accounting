/** סטטוסים בהם ניתן לערוך שדות ולהגיש מסמך (לפני שליחת רו״ח; ללא טיוטה/בעיות איכות). */
export const CLIENT_DOCUMENT_EDITABLE_STATUSES = [
  "uploaded",
  "needs_review",
  "ready_to_submit",
  "ocr_failed",
] as const;

export type ClientDocumentEditableStatus =
  (typeof CLIENT_DOCUMENT_EDITABLE_STATUSES)[number];

export function isClientDocumentEditable(
  status: string,
): status is ClientDocumentEditableStatus {
  return (CLIENT_DOCUMENT_EDITABLE_STATUSES as readonly string[]).includes(
    status,
  );
}
