/** קריאת גוף fetch כ‑JSON עם fallback — מונע JSON.parse בשגיאה כשמתקבל HTML/502 */
export async function parseJsonBodyFromFetchResponse<
  T extends Record<string, unknown>,
>(res: Response): Promise<{ json: T | null; raw: string }> {
  const raw = await res.text();
  const t = raw.trim();
  if (!t.length) return { json: null, raw: "" };
  try {
    return { json: JSON.parse(t) as T, raw };
  } catch {
    return { json: null, raw };
  }
}
