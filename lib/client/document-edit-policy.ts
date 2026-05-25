/** סטטוסים בהם לקוח רשאי לערוך שדות חשבונית (לאחר סיום עיבוד ההעלאה). */
export const CLIENT_DOCUMENT_EDITABLE_STATUSES = ["uploaded"] as const;

export type ClientDocumentEditableStatus =
  (typeof CLIENT_DOCUMENT_EDITABLE_STATUSES)[number];

export function isClientDocumentEditable(
  status: string,
): status is ClientDocumentEditableStatus {
  return (CLIENT_DOCUMENT_EDITABLE_STATUSES as readonly string[]).includes(
    status,
  );
}
