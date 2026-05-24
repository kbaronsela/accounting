-- ⚠ בשם טבלה שגוי במקום "document"; מיושר בשקט ב־0007_fix_document_migration_chain.sql — אל תשנו כאן בלי התאמת hash למיגרטור.

UPDATE "documents"
WHERE upper(trim(coalesce("finalCurrency", ''))) IN ('ILS', 'NIS');

UPDATE "documents"
SET "extractedCurrency" = 'ש״ח'
WHERE upper(trim(coalesce("extractedCurrency", ''))) IN ('ILS', 'NIS');
