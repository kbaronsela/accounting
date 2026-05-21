import type { ClientDocumentRow } from "@/lib/client/document-access";

/** סכום חיובי (עד שני עשרוניים) */
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SubmitFieldErrors = Record<string, string[]>;

/**
 * ולידציה לפני submit — `docs/architecture.md` §7
 */
export function validateDocumentForSubmit(
  doc: Pick<
    ClientDocumentRow,
    "finalAmount" | "finalCurrency" | "finalDate" | "finalVendor"
  >,
): SubmitFieldErrors {
  const fields: SubmitFieldErrors = {};

  const amount = doc.finalAmount?.trim() ?? "";
  if (!amount) {
    fields.finalAmount = ["חובה"];
  } else if (!AMOUNT_RE.test(amount) || Number.isNaN(Number.parseFloat(amount))) {
    fields.finalAmount = ["מספר תקין נדרש (למשל 123.45)"];
  }

  const currency = doc.finalCurrency?.trim() ?? "";
  if (!currency) {
    fields.finalCurrency = ["חובה"];
  } else if (currency.length > 12) {
    fields.finalCurrency = ["עד 12 תווים"];
  }

  const date = doc.finalDate?.trim() ?? "";
  if (!date) {
    fields.finalDate = ["חובה"];
  } else if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    fields.finalDate = ["תאריך בפורמט YYYY-MM-DD"];
  }

  const vendor = doc.finalVendor?.trim() ?? "";
  if (!vendor) {
    fields.finalVendor = ["חובה"];
  } else if (vendor.length > 500) {
    fields.finalVendor = ["עד 500 תווים"];
  }

  return fields;
}

export function hasSubmitFieldErrors(fields: SubmitFieldErrors): boolean {
  return Object.keys(fields).length > 0;
}
