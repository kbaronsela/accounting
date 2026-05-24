-- היסטוריית ההגירה השתמשה בשגיאה בשם טבלה; ב‑DB ההטבלה היא מיקומית "document" (singular).
UPDATE "document"
SET "finalCurrency" = 'ש״ח'
WHERE upper(trim(coalesce("finalCurrency", ''))) IN ('ILS', 'NIS');

UPDATE "document"
SET "extractedCurrency" = 'ש״ח'
WHERE upper(trim(coalesce("extractedCurrency", ''))) IN ('ILS', 'NIS');
