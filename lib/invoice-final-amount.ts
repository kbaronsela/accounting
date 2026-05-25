/**
 * סכום חשבונית סופי (`documents.finalAmount` וכן `extractedAmount` מ־OCR):
 * מאוחסן כמחרוזת עם נקודה עשרונית ותמיד בדיוק שתי ספרות אחרי הנקודה — "12.00".
 */

export type NormalizeFinalInvoiceAmountResult =
  | { ok: true; value: string | null }
  | { ok: false };

/** מנרמל קלט משתמש/מערכת לערך לשמירה; מחרוזת ריקה → null. */
export function tryNormalizeFinalInvoiceAmountStored(
  raw: string,
): NormalizeFinalInvoiceAmountResult {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t.length) return { ok: true, value: null };
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  const rounded = Math.round(n * 100) / 100;
  return { ok: true, value: rounded.toFixed(2) };
}

/** תצוגת טבלה/דוח: ללא סכום → "—", אחרת תמיד שתי עשרוניות עם נקודה. */
export function formatFinalInvoiceAmountDisplay(
  amount: string | null | undefined,
): string {
  const t = amount?.trim()?.replace(",", ".") ?? "";
  if (!t.length) return "—";
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return amount!.trim();
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** ערך לשדה קלט בטופס — ריק תמיד "", אחרת בתבנית #.## */
export function finalInvoiceAmountInputValueFromStored(
  amount: string | null | undefined,
): string {
  const t = amount?.trim()?.replace(",", ".") ?? "";
  if (!t.length) return "";
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return (amount ?? "").trim();
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** ל־OCR ושדות מאוחסנים שנחלצו — null אם ריק או לא ניתן לנרמל. */
export function canonicalFinalInvoiceAmountOrNull(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const r = tryNormalizeFinalInvoiceAmountStored(raw);
  return r.ok ? r.value : null;
}
