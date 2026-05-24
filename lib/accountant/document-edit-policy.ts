/** מסמכים שכבר אצל הרו״ח (לאחר הגשה) — עריכת שדות חשבונית */
const ACCOUNTANT_INVOICE_EDIT_STATUSES = ["submitted", "archived"] as const;

export function canAccountantEditSubmittedInvoiceFields(status: string): boolean {
  return (ACCOUNTANT_INVOICE_EDIT_STATUSES as readonly string[]).includes(status);
}

/** לאחר אישור — אין עריכת שדות חשבונית; לפני כן מתאים לאשר רק מתוך «נשלח לרו״ח». */
export function canAccountantApproveDocument(status: string): boolean {
  return status === "submitted";
}
