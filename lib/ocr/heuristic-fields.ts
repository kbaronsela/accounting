import { SHEKEL_DISPLAY } from "@/lib/client/currency-canonical";
import { parseFlexibleInvoiceDate } from "@/lib/client/date-input-helpers";

export type HeuristicExtraction = {
  extractedAmount: string | null;
  extractedCurrency: string | null;
  extractedDate: string | null;
  extractedVendor: string | null;
  /** מספר חשבונית / קבלה — לפי תוויות טקסט ב־OCR */
  extractedInvoiceNumber: string | null;
};

function europeanFriendlyToDecimal(raw: string): number | null {
  let s = raw.replace(/\s+/g, "").replace(/[^\d,.'']/g, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = `${parts[0]}.${parts[1]}`;
    } else {
      s = s.replace(/,/g, "");
    }
  }

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function decimalToStoredAmount(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const rounded = Math.round(n * 100) / 100;
  const s = rounded.toFixed(2);
  /** ולידציית PATCH/הגשה — עד ספרות עשרוניים */
  return s;
}

/** רמז שיש במסמך סימן מחיר/מטבע (המערכת שומרת תמיד ש״ח) */
function hasAnyCurrencyHint(text: string): boolean {
  return /₪|ש[\"״']?ח|שקל|NIS\b|ILS\b|NEW\s*Sheqel|\$|\bUSD\b|€|\bEUR\b/i.test(
    text,
  );
}

function isoFromFlexibleCandidate(candidate: string): string | null {
  const hyphenIso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(candidate.trim());
  if (hyphenIso) {
    const dotted = `${hyphenIso[3].padStart(2, "0")}.${hyphenIso[2].padStart(2, "0")}.${hyphenIso[1]}`;
    const r = parseFlexibleInvoiceDate(dotted);
    return r.ok ? r.iso : null;
  }
  const normalized = candidate.trim().replace(/[\\/]/g, ".").replace(/-/g, ".");
  const r = parseFlexibleInvoiceDate(normalized);
  return r.ok ? r.iso : null;
}

function scanDates(text: string): string[] {
  const hits: string[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
    const iso = isoFromFlexibleCandidate(m[0]);
    if (iso && !seen.has(iso)) {
      hits.push(iso);
      seen.add(iso);
    }
  }

  for (const m of text.matchAll(
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/g,
  )) {
    const iso = isoFromFlexibleCandidate(m[1] ?? m[0]);
    if (iso && !seen.has(iso)) {
      hits.push(iso);
      seen.add(iso);
    }
  }
  return hits;
}

/** בוחרים תאריך קרוב לתווית תאריך במסמך, אם יש — אחרת הראשון */
function scanDate(text: string): string | null {
  const dates = scanDates(text);
  if (dates.length === 0) return null;

  const lower = text.toLowerCase();
  const labelIdx =
    /\bתאריך\b/i.exec(text)?.index ??
    /\bdate\b/i.exec(lower)?.index ??
    /\bמשלוח\b/i.exec(text)?.index ??
    /invoice\b/i.exec(lower)?.index;

  if (labelIdx !== undefined && labelIdx >= 0) {
    const windowText = text.slice(
      Math.max(0, labelIdx - 20),
      Math.min(text.length, labelIdx + 80),
    );
    const nearby = scanDates(windowText);
    if (nearby[0]) return nearby[0];
  }
  /** לרוב בעמודי קבלה התאריך האחרון שמוזכר מתחת למטה — לוקח את המאוחר בין הראשונים */
  return dates[dates.length - 1] ?? dates[0] ?? null;
}

function scanAmount(text: string): string | null {
  const amounts: number[] = [];

  for (const m of text.matchAll(
    /(?:סה[\"״']?כ|סיכום|TOTAL|לתשלום|Amount\s*due|סכום\s*כולל|Balance\s*due)\s*[:\s]*([\d\s,.'']+)/gi,
  )) {
    const n = europeanFriendlyToDecimal(m[1] ?? "");
    if (n !== null && n > 0 && n < 100_000_000) amounts.push(n);
  }

  for (const m of text.matchAll(
    /([\d\s,]{1,14}(?:[\.,]\d{1,4})?)\s*(?:₪|ILS\b|ש[\"״']?ח\b|USD\b|EUR\b|\€|\$)/gi,
  )) {
    const n = europeanFriendlyToDecimal(m[1] ?? "");
    if (n !== null && n > 0 && n < 100_000_000) amounts.push(n);
  }

  /** לכידה כללית של צורות X.XX בשורות הבסוף של המסמך */
  if (amounts.length === 0) {
    const tail = text.slice(Math.max(0, text.length - Math.min(text.length, 1200)));
    for (const m of tail.matchAll(/\b(\d[\d\s,]{0,12}[.,]\d{2})\b/g)) {
      const n = europeanFriendlyToDecimal(m[1] ?? "");
      if (n !== null && n > 0 && n < 100_000_000) amounts.push(n);
    }
  }

  if (amounts.length === 0) return null;

  /** נוחות: לרוב הקבלה מציגת סיכום בסכום הגבוה ביותר בשורות אחרונות */
  return decimalToStoredAmount(Math.max(...amounts));
}

function clipInvoiceNumberFragment(raw: string): string {
  const oneLine = raw.split(/\r?\n/)[0] ?? raw;
  const stop = /(?:\s{2,}|,|;|\||\t|תאריך|Date|סיכום|סה|Total|₪|ILS|USD)/i;
  const cut = stop.exec(oneLine);
  const slice = cut ? oneLine.slice(0, cut.index) : oneLine;
  return slice.trim();
}

function normalizeInvoiceNumberCandidate(raw: string): string | null {
  let s = clipInvoiceNumberFragment(raw)
    .replace(/[\u200f\u202a-\u202e]/g, "")
    .replace(/^[\s:.\-–—#׳״'"]+|[\s:.\-–—#]+$/g, "");
  s = s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  // הסרת "/קבלה" או "קבלה" בתחילה — תופעת לוואי של תיוג "מס/קבלה" ב-OCR
  s = s.replace(/^[/\\]?\s*קבלה\s*/i, "").trim();
  if (!s || s.length < 2 || s.length > 64) return null;
  if (!/[\da-zA-Z\u0590-\u05FF]/.test(s)) return null;
  return s.slice(0, 80);
}

/**
 * מזהה מספר חשבונית או קבלה לפי תוויות נפוצות (עברית / אנגלית).
 * שמרני — אם אין תווית מתאימה מחזיר null.
 */
export function scanInvoiceOrReceiptNumber(raw: string): string | null {
  const text = raw.replace(/\u00A0/g, " ").replace(/\ufeff/g, "");
  const patterns: RegExp[] = [
    /(?:מ\s*ס(?:פר|\.)?|מ\s*ס['׳״']?\s*)\s*חשבונית\s*(?:מס(?:פר)?|מ\s*ס['׳״']?)?\s*[:\s.\-–—#]*\s*([^\n\r]{1,72})/gi,
    // "חשבונית מס/קבלה" / "חשבונית מסקבלה" — ה-"/קבלה" הוא חלק מהתווית, לא מהמספר
    /חשבונית\s*(?:מס(?:פר|קבלה)?|מ\s*ס['׳״']?(?:\s*מר)?)(?:\s*[/\\]\s*קבלה)?\s*[:\s.\-–—#]*\s*([^\n\r]{1,72})/gi,
    /מס(?:פר)?\s*קבלה\s*[:\s.\-–—#]*\s*([^\n\r]{1,72})/gi,
    /קבלה\s*(?:מס(?:פר)?)?\s*(?:מס['׳״']?)?\s*[:\s.\-–—#]*\s*([^\n\r]{1,72})/gi,
    /Invoice\s*(?:No\.?|#|Number)?\s*[:\s]*([^\n\r]{1,72})/gi,
    /Receipt\s*(?:No\.?|#|Number)?\s*[:\s]*([^\n\r]{1,72})/gi,
    /Inv\.?\s*No\.?\s*[:\s]*([^\n\r]{1,72})/gi,
  ];

  const seen = new Set<string>();
  for (const re of patterns) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const norm = normalizeInvoiceNumberCandidate(m[1] ?? "");
      if (!norm) continue;
      const key = norm.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      return norm;
    }
  }
  return null;
}

function guessVendor(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 4);

  const junk =
    /^[\d\s.:/_-]+$|^www\.|^https?:\/\/|^@\b|^\d{9,}|^fax|^פакс|^tel|^טל|^phone|^משלוח|^תודה|^receipt|^invoice\b|^עותק|^copy$/i;

  for (let i = 0; i < Math.min(lines.length, 35); i += 1) {
    const line = lines[i] ?? "";
    if (junk.test(line)) continue;
    if (line.length > 180) continue;
    if (/ח\.?\s*פ\.?\s*[:\s]?\s*\d|ע\.?\s*מ\.?\s*[:\s]?\s*\d|VAT\b|TAX\b/i.test(line)) continue;
    if (!/[\u0590-\u05FFA-Za-z]{3}/.test(line)) continue;
    /** לעיתים שורות כותרת קצרות מדי */
    const cleaned = line.replace(/\s{2,}/g, " ");
    return cleaned.slice(0, 500);
  }
  return null;
}

/** חילוץ שמרני לקבלות/חשבוניות מתוך טקסט גולמי (OCR או טקסט מוטמע ב־PDF) */
export function extractHeuristicInvoiceFields(raw: string): HeuristicExtraction {
  const text = raw.replace(/\u00A0/g, " ").replace(/\ufeff/g, "");
  const extractedDate = scanDate(text);
  const extractedAmount = scanAmount(text);
  const extractedCurrency =
    extractedAmount || hasAnyCurrencyHint(text) ? SHEKEL_DISPLAY : null;
  const extractedVendor = guessVendor(text);
  const extractedInvoiceNumber = scanInvoiceOrReceiptNumber(text);
  return {
    extractedAmount,
    extractedCurrency,
    extractedDate,
    extractedVendor,
    extractedInvoiceNumber,
  };
}
