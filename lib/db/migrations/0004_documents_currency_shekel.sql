UPDATE "documents"
SET "finalCurrency" = 'ש״ח'
WHERE upper(trim(coalesce("finalCurrency", ''))) IN ('ILS', 'NIS');

UPDATE "documents"
SET "extractedCurrency" = 'ש״ח'
WHERE upper(trim(coalesce("extractedCurrency", ''))) IN ('ILS', 'NIS');
