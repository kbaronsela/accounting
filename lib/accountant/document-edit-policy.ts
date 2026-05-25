/** מסמכים בשלב לפני אישור סופי — עריכת שדות חשבונית */
const ACCOUNTANT_INVOICE_EDIT_STATUSES = ["uploaded"] as const;

export function canAccountantEditSubmittedInvoiceFields(
  status: string,
): boolean {
  return (ACCOUNTANT_INVOICE_EDIT_STATUSES as readonly string[]).includes(
    status,
  );
}

/** אישור סופי מתוך סטטוס «הועלה» (אחרי OCR). */
export function canAccountantApproveDocument(status: string): boolean {
  return status === "uploaded";
}
