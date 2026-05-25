/** תוויות סטטוס מסמך בממשק (עברית). מזהי DB נשארים באנגלית. */

export const DOCUMENT_STATUS_LABEL_HE: Record<string, string> = {
  draft_uploading: "בעיבוד",
  ocr_processing: "בעיבוד",
  uploaded: "הועלה",
  /** לפני מיגרציה / נתונים ישנים בלבד */
  needs_review: "דורש בדיקה (ישן)",
  ready_to_submit: "מוכן לשליחה (ישן)",
  submitted: "לפני אישור (ישן)",
  ocr_failed: "כשל בעיבוד (ישן)",
  approved: "אושר",
  rejected_quality: "נדחה (איכות)",
  archived: "בארכיון",
};

export function documentStatusLabelHebrew(status: string): string {
  return DOCUMENT_STATUS_LABEL_HE[status] ?? status;
}

/** מסמך בטעינה או בחילוץ טקסט — אין עדיין עריכת פרטי חשבונית */
export function isDocumentProcessingStatus(status: string): boolean {
  return status === "draft_uploading" || status === "ocr_processing";
}
