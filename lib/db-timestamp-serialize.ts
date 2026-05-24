/**
 * מנרמל ערך timestamp מתוך DB / Drizzle למחרוזת ISO או null —
 * למניעת קריסה כש־`toISOString` לא זמין (למשל אם הגיע טיפ לא צפוי).
 */
export function dbTimestampToIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isNaN(ms) ? null : v.toISOString();
  }
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}
