/**
 * המערכת עובדת רק בשקל — תצוגה ושדה מאוחסן כ־«ש״ח».
 * כל ערך מטבע לא ריק מנורמל לש״ח (כולל ILS/NIS/USD/EUR היסטוריים).
 */

export const SHEKEL_DISPLAY = "\u05E9\u05F4\u05D7";

/** מנרמל לערך מאוחסן — תמיד ש״ח אם יש תוכן, אחרת null */
export function canonicalizeCurrency(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return SHEKEL_DISPLAY;
}
