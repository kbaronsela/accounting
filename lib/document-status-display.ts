/**
 * מודל סטטוס מסמך: ב־ממשק ארבע תוויות עברית בלבד —
 * «בעיבוד» (טיוטת העלאה / OCR), «הועלה», «אושר», «בארכיון».
 *
 * בבסיס הנתונים נשמרים `draft_uploading` ו־`ocr_processing` (שניהם נחשבים «בעיבוד»).
 */

export const DOCUMENT_PROCESSING_STATUSES = [
  "draft_uploading",
  "ocr_processing",
] as const;

export const DOCUMENT_ACTIVE_LIST_STATUSES = ["uploaded", "approved"] as const;

/** אחרי שהקובץ בשטח אחסון — אידומפוטנטיות בהשלמת העלאה */
export const DOCUMENT_POST_DRAFT_UPLOAD_STATUSES = [
  "ocr_processing",
  "uploaded",
  "approved",
  "archived",
] as const;

const DOCUMENT_STATUS_LABEL_HE: Record<string, string> = {
  draft_uploading: "בעיבוד",
  ocr_processing: "בעיבוד",
  uploaded: "הועלה",
  approved: "אושר",
  archived: "בארכיון",
};

export function documentStatusLabelHebrew(status: string): string {
  return DOCUMENT_STATUS_LABEL_HE[status] ?? "הועלה";
}

/** למיון לפי סטטוס: בעיבוד ← הועלה ← אושר ← בארכיון */
export function documentStatusSortRank(status: string): number {
  if (status === "draft_uploading" || status === "ocr_processing") return 0;
  if (status === "uploaded") return 1;
  if (status === "approved") return 2;
  if (status === "archived") return 3;
  return 1;
}

/** מסמך בטעינה או בחילוץ טקסט — אין עדיין עריכת פרטי חשבונית */
export function isDocumentProcessingStatus(status: string): boolean {
  return (
    status === "draft_uploading" || status === "ocr_processing"
  );
}

/** סינון רשימות API: ברירת מחדל ללא פרמטר / active = הועלה או אושר */
export type DocumentListStatusFilter =
  | "active"
  | "all"
  | "processing"
  | "uploaded"
  | "approved"
  | "archived";

export function parseDocumentListStatusFilter(
  raw: string | null | undefined,
): DocumentListStatusFilter {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s || s === "active") return "active";
  if (s === "all") return "all";
  if (s === "processing") return "processing";
  if (s === "uploaded") return "uploaded";
  if (s === "approved") return "approved";
  if (s === "archived") return "archived";
  return "active";
}
