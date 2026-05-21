/** callbackUrl מתוך שאילתא — לא לפתוח הפניות פתוחות אל מחוץ לאתר */
export function sanitizeAuthCallbackUrl(
  raw: string | string[] | null | undefined,
): string {
  if (Array.isArray(raw)) raw = raw[0];
  if (!raw?.trim()) return "/";
  try {
    const u = decodeURIComponent(raw.trim());
    if (!u.startsWith("/")) return "/";
    if (u.startsWith("//")) return "/";
    return u;
  } catch {
    return "/";
  }
}
