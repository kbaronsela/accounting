import type { ClientDocumentRow } from "@/lib/client/document-access";
import { tryNormalizeFinalInvoiceAmountStored } from "@/lib/invoice-final-amount";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SubmitFieldErrors = Record<string, string[]>;

/**
 * ולידציה לפני submit / שמירה אצל רו״ח — כל השדות אופציונליים; אם ממלאים — נבדק פורמט בלבד.
 * (`docs/architecture.md` §7)
 */
export function validateDocumentForSubmit(
  doc: Pick<
    ClientDocumentRow,
    "finalAmount" | "finalCurrency" | "finalDate" | "finalVendor"
  >,
): SubmitFieldErrors {
  const fields: SubmitFieldErrors = {};

  const amount = doc.finalAmount?.trim() ?? "";
  if (amount) {
    const norm = tryNormalizeFinalInvoiceAmountStored(amount);
    if (!norm.ok) {
      fields.finalAmount = ["מספר תקין נדרש (למשל 123.45)"];
    }
  }

  const currency = doc.finalCurrency?.trim() ?? "";
  if (currency.length > 12) {
    fields.finalCurrency = ["עד 12 תווים"];
  }

  const date = doc.finalDate?.trim() ?? "";
  if (date) {
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      fields.finalDate = ["תאריך בפורמט YYYY-MM-DD"];
    }
  }

  const vendor = doc.finalVendor?.trim() ?? "";
  if (vendor.length > 500) {
    fields.finalVendor = ["עד 500 תווים"];
  }

  return fields;
}

export function hasSubmitFieldErrors(fields: SubmitFieldErrors): boolean {
  return Object.keys(fields).length > 0;
}
