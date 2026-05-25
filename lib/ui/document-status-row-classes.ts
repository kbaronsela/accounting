/**
 * רקעים בהירים מאוד ושונות קלה בין סטטוסים לשורות ברשימת מסמכים (לקוח / רו״ח).
 * ארבע תוויות משתמש (בעיבוד ≈ draft_uploading · ocr_processing).
 */
export function documentStatusRowSurfaceClass(status: string): string {
  switch (status) {
    case "draft_uploading":
    case "ocr_processing":
      return "bg-indigo-50/88 hover:bg-indigo-100/68 focus-visible:bg-indigo-100/68";
    case "uploaded":
      return "bg-sky-50/90 hover:bg-sky-100/72 focus-visible:bg-sky-100/72";
    case "approved":
      return "bg-green-50/90 hover:bg-green-100/72 focus-visible:bg-green-100/72";
    case "archived":
      return "bg-stone-50/92 hover:bg-stone-100/78 focus-visible:bg-stone-100/78";
    default:
      return "bg-zinc-50/90 hover:bg-zinc-100/75 focus-visible:bg-zinc-100/75";
  }
}
