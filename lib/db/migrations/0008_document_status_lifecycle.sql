-- איחוד מחזור חיים: אחרי OCR המסך הוא «הועלה»; ללא סטטוס «נשלח לרו״ח».
UPDATE "document"
SET
  status = 'uploaded',
  "submittedAt" = NULL
WHERE status IN (
  'needs_review',
  'ready_to_submit',
  'submitted',
  'ocr_failed'
);
