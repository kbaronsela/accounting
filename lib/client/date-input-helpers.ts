/**
 * תאריך לתצוגה (DD.MM.YYYY); שמירה ב־API — YYYY-MM-DD.
 */

function pad2(n: number): string {
  return n >= 10 ? String(n) : `0${n}`;
}

/** ISO YYYY-MM-DD (תקין בלוח) → DD.MM.YYYY */
export function isoDateToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidCalendarDate(y, mo, d)) return "";
  return `${pad2(d)}.${pad2(mo)}.${m[1]}`;
}

/** תאריך מקומי של היום בפורמט ISO */
export function todayIsoLocal(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900 ||
    year > 2100
  ) {
    return false;
  }
  const test = new Date(Date.UTC(year, month - 1, day));
  return (
    test.getUTCFullYear() === year &&
    test.getUTCMonth() === month - 1 &&
    test.getUTCDate() === day
  );
}

/** ISO מתוך DB — רק תבנית מלאה וחוקית */
export function parseStoredIsoDate(
  s: string | null | undefined,
): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidCalendarDate(y, mo, d)) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export type FlexibleDateParse =
  | { ok: true; iso: string; displayNormalized: string }
  | { ok: false; message: string };

/**
 * פרסום בטוח למסגרת הפורמטים המוכרים; אחרת השגיאה לצג המשתמש.
 */
export function parseFlexibleInvoiceDate(raw: string): FlexibleDateParse {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "חובה להזין תאריך" };
  }

  /** ISO עם מקפים — ללא הספק */
  const isoHyphen = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoHyphen) {
    const y = Number(isoHyphen[1]);
    const mo = Number(isoHyphen[2]);
    const d = Number(isoHyphen[3]);
    if (!isValidCalendarDate(y, mo, d)) {
      return { ok: false, message: "התאריך אינו קיים בלוח" };
    }
    const iso = `${isoHyphen[1]}-${isoHyphen[2]}-${isoHyphen[3]}`;
    return {
      ok: true,
      iso,
      displayNormalized: isoDateToDisplay(iso),
    };
  }

  const dotted = trimmed
    .replace(/[\\/]/g, ".")
    .replace(/-/g, ".");
  const parts = dotted.split(".").filter((p) => p.length > 0);
  if (parts.length !== 3) {
    return {
      ok: false,
      message:
        'פורמט לא זוהה בביטחון. למשל: 05.02.2026 — או יש לבחור מתאריכון («בחירת תאריך»).',
    };
  }

  const [a, b, c] = parts;

  /** נקודות: YYYY.M.D ישן ראשון (חלק ראשון = 4 ספרות) */
  if (/^\d{4}$/.test(a) && /^\d{1,2}$/.test(b) && /^\d{1,2}$/.test(c)) {
    const y = Number(a);
    const mo = Number(b);
    const d = Number(c);
    if (!isValidCalendarDate(y, mo, d)) {
      return { ok: false, message: "התאריך אינו קיים בלוח" };
    }
    const iso = `${a}-${pad2(mo)}-${pad2(d)}`;
    return {
      ok: true,
      iso,
      displayNormalized: isoDateToDisplay(iso),
    };
  }

  /** DD.MM.YYYY — שנה (4 ספרות) בחלק האחרון */
  if (
    /^\d{1,2}$/.test(a) &&
    /^\d{1,2}$/.test(b) &&
    /^\d{4}$/.test(c)
  ) {
    const day = Number(a);
    const month = Number(b);
    const year = Number(c);
    if (!isValidCalendarDate(year, month, day)) {
      return { ok: false, message: "התאריך אינו קיים בלוח" };
    }
    const iso = `${year}-${pad2(month)}-${pad2(day)}`;
    return {
      ok: true,
      iso,
      displayNormalized: isoDateToDisplay(iso),
    };
  }

  /**
   * DD.MM.YY — שתי ספרות שנה קצרות: 70–99 → 19YY, אחרת 20YY עד תשעים ותשע.
   * (מתאים לחשבוניות עד שנות האלפיים / תשעים.)
   */
  if (/^\d{1,2}$/.test(a) && /^\d{1,2}$/.test(b) && /^\d{2}$/.test(c)) {
    const day = Number(a);
    const month = Number(b);
    const yy = Number(c);
    const year = yy <= 69 ? 2000 + yy : 1900 + yy;
    if (!isValidCalendarDate(year, month, day)) {
      return { ok: false, message: "התאריך אינו קיים בלוח" };
    }
    const iso = `${year}-${pad2(month)}-${pad2(day)}`;
    return {
      ok: true,
      iso,
      displayNormalized: isoDateToDisplay(iso),
    };
  }

  return {
    ok: false,
    message:
      'לא ניתן לפרק את התאריך בצורה בטוחה. דוגמה: 05.02.2026 — או "בחירת תאריך" מתאריכון.',
  };
}
