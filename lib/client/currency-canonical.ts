/**
 * שקל — תצוגה ושדה מאוחסן כ־«ש״ח» במקום קוד ISO ‎ILS‎ / ‎NIS‎.
 */

export const SHEKEL_DISPLAY = "\u05E9\u05F4\u05D7";

/** מנרמל לערך מאוחסן (ש״ח / USD / EUR או טקסט קצר). */
export function canonicalizeCurrency(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const t = raw.trim();
  if (t.length === 0) return null;

  const onlyLatinLetters = /^[A-Za-z\s]+$/;
  if (onlyLatinLetters.test(t)) {
    const u = t.replace(/\s+/g, "").toUpperCase();
    if (u === "ILS" || u === "NIS") return SHEKEL_DISPLAY;
    if (u === "USD") return "USD";
    if (u === "EUR") return "EUR";
    return u.length <= 12 ? u : null;
  }

  const collapsed = t.replace(/\s+/g, "");
  if (/^ש["״'\u05F4]?ח$/u.test(collapsed)) {
    return SHEKEL_DISPLAY;
  }
  if (/שקל/i.test(t)) {
    return SHEKEL_DISPLAY;
  }

  if (collapsed.toUpperCase() === "USD") return "USD";
  if (collapsed.toUpperCase() === "EUR") return "EUR";

  return t.length <= 12 ? t : null;
}
