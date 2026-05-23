/**
 * סגינד אחיד למודאלי האפליקציה (טיל–איזמרלד כמו בשאר העיצוב).
 */

/** שכבת רקע (כפתור) מתחת לחלון — האב עם `fixed inset-0` */
export const appModalBackdropClass =
  "absolute inset-0 bg-teal-950/45 backdrop-blur-[2px]";

/** Overlay מלא למודאל ממורכז (למשל דיאלוג אישור) */
export const appModalFullscreenOverlayClass =
  "fixed inset-0 z-50 flex items-center justify-center bg-teal-950/45 p-3 backdrop-blur-[2px]";

/** אלמנט הכרטיס: יש להוסיף למשל max-w-lg / max-w-md במקום הקריאה */
export const appModalPanelSurfaceClass =
  "relative z-10 my-4 flex w-full flex-col overflow-hidden rounded-2xl border border-teal-100/95 bg-white/95 shadow-[0_24px_60px_-28px_rgb(13_148_136_/_0.32)] backdrop-blur-sm sm:my-6";

/** מודאל ממורכז עם גלילה פנימית (לא full-height sheet) */
export const appModalCenteredPaperClass =
  "w-full max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border border-teal-100/95 bg-white/95 p-4 shadow-[0_24px_60px_-28px_rgb(13_148_136_/_0.32)] backdrop-blur-sm sm:p-6";

export const appModalHeaderClass =
  "relative shrink-0 border-b border-teal-100/90 bg-gradient-to-l from-teal-50/70 via-white to-transparent px-4 py-3 sm:px-5";

export const appModalCloseButtonClass =
  "absolute end-3 top-3 rounded-lg p-1.5 text-teal-800/65 transition hover:bg-teal-50 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50";

/** כפתורי שליחה / פעולה ראשית בתוך מודאל */
export const appModalPrimaryButtonClass =
  "rounded-xl bg-gradient-to-bl from-teal-700 to-emerald-900 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-900/25 transition hover:from-teal-800 hover:to-emerald-950 disabled:opacity-60";

export const appModalPrimaryButtonXsClass =
  "rounded-lg bg-gradient-to-bl from-teal-700 to-emerald-900 px-2.5 py-1 text-xs font-semibold text-white shadow-sm shadow-teal-900/20 hover:from-teal-800 hover:to-emerald-950 disabled:opacity-50";

export const appModalPrimaryButtonXsWideClass =
  "rounded-lg bg-gradient-to-bl from-teal-700 to-emerald-900 px-2 py-1.5 text-xs font-semibold text-white shadow-sm shadow-teal-900/20 hover:from-teal-800 hover:to-emerald-950 disabled:opacity-50";

/** שדות קלט במודאל — הוסף w-full בעצמך במידת הצורך */
export const appModalInputClass =
  "rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/25 disabled:bg-teal-50/40";

/** ביטול / משני */
export const appModalSecondaryButtonClass =
  "rounded-lg border border-teal-200/90 bg-white px-2.5 py-1 text-xs font-medium text-teal-900 shadow-sm hover:bg-teal-50 disabled:opacity-50";

export const appModalGhostButtonClass =
  "rounded-xl border border-teal-200/90 bg-white px-4 py-2 text-sm font-medium text-teal-900 shadow-sm hover:bg-teal-50 disabled:opacity-50";
