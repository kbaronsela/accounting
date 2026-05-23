/** מסמכים שכבר אצל הרו״ח (לאחר הגשה) — עריכת שדות חשבונית */
const ACCOUNTANT_INVOICE_EDIT_STATUSES = ["submitted", "archived"] as const;

export function canAccountantEditSubmittedInvoiceFields(status: string): boolean {
  return (ACCOUNTANT_INVOICE_EDIT_STATUSES as readonly string[]).includes(status);
}
