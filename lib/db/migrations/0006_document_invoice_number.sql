ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "extractedInvoiceNumber" text;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "finalInvoiceNumber" text;
