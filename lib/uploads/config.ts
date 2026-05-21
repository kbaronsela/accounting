/** גודל מרבי לקובץ יחיד (bytes) */
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024; // 20 MiB

export const UPLOAD_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type UploadMimeType = (typeof UPLOAD_ALLOWED_MIME_TYPES)[number];

export function isAllowedUploadMime(mime: string): mime is UploadMimeType {
  return (UPLOAD_ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/** שם תיקייה יחסית ל־cwd (ללא path.resolve בטעינת מודול — רק בזמן ריצה ב-local-store). */
export function getLocalUploadRelativeDir(): string {
  return process.env.LOCAL_UPLOAD_DIR?.trim() || ".data/uploads";
}
