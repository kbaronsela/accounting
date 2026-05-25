-- ארבע קבוצות סטטוס ב־UI: בעיבוד | הועלה | אושר | בארכיון (ב־DB נשארים draft_uploading / ocr_processing נפרדים).
-- ממפה כל ערך Legacy לערך נתמך.
UPDATE "document"
SET status = 'uploaded'
WHERE status IN (
  'needs_review',
  'ready_to_submit',
  'submitted',
  'ocr_failed'
);

UPDATE "document"
SET status = 'archived'
WHERE status = 'rejected_quality';

UPDATE "document"
SET status = 'uploaded'
WHERE status NOT IN (
  'draft_uploading',
  'ocr_processing',
  'uploaded',
  'approved',
  'archived'
);
