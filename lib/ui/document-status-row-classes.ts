/**
 * רקעים בהירים מאוד ושונות קלה בין סטטוסים לשורות ברשימת מסמכים (לקוח / רו״ח).
 * כולל מצבי hover / focus-visible לשורות שניתן למקודד עליהן.
 */
export function documentStatusRowSurfaceClass(status: string): string {
  switch (status) {
    case "draft_uploading":
      return "bg-indigo-50/88 hover:bg-indigo-100/68 focus-visible:bg-indigo-100/68";
    case "uploaded":
      return "bg-sky-50/90 hover:bg-sky-100/72 focus-visible:bg-sky-100/72";
    case "ocr_processing":
      return "bg-indigo-50/88 hover:bg-indigo-100/68 focus-visible:bg-indigo-100/68";
    case "needs_review":
      return "bg-amber-50/90 hover:bg-amber-100/75 focus-visible:bg-amber-100/75";
    case "ocr_failed":
      return "bg-rose-50/88 hover:bg-rose-100/70 focus-visible:bg-rose-100/70";
    case "ready_to_submit":
      return "bg-emerald-50/90 hover:bg-emerald-100/70 focus-visible:bg-emerald-100/70";
    case "submitted":
      return "bg-teal-50/88 hover:bg-teal-100/70 focus-visible:bg-teal-100/70";
    case "approved":
      return "bg-green-50/90 hover:bg-green-100/72 focus-visible:bg-green-100/72";
    case "rejected_quality":
      return "bg-orange-50/90 hover:bg-orange-100/72 focus-visible:bg-orange-100/72";
    case "archived":
      return "bg-stone-50/92 hover:bg-stone-100/78 focus-visible:bg-stone-100/78";
    default:
      return "bg-zinc-50/90 hover:bg-zinc-100/75 focus-visible:bg-zinc-100/75";
  }
}
