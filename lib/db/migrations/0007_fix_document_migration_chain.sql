-- הגירה 0004 הפניתה בשגיאה לטבלה "documents" (לא קיימת; במסד ההטבלה היא "document").
-- מה שגרם לכישלון בשרשרת ההגירות ולכן עמודות כמו extractedInvoiceNumber (0006)
-- לא הוזמנו בהמון סביבות פרודקשן — וה-insert מתוך האפליקציה מתרסק.
-- מתקן בשקט (אידמפוטנטי) עם IF NOT EXISTS, ומריץ את עדכון המטבע על השם הנכון.

ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "extractedInvoiceNumber" text;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "finalInvoiceNumber" text;

UPDATE "document"
SET "finalCurrency" = 'ש״ח'
WHERE upper(trim(coalesce("finalCurrency", ''))) IN ('ILS', 'NIS');

UPDATE "document"
SET "extractedCurrency" = 'ש״ח'
WHERE upper(trim(coalesce("extractedCurrency", ''))) IN ('ILS', 'NIS');
