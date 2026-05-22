import "server-only";

/**
 * בחירת backend אחסון — הרצת שרת בלבד.
 *
 * בשירות פרוס (Railway/Vercel) bundler עלול להחליף גישות מסוג process.env.KEY
 * בערך מזמן build. לכן שם משתנה נבנה בזמן ריצה עם `String.fromCharCode`.
 */

export type DocumentsStorageBackend = "local" | "s3";

const DOCUMENTS_STORAGE_ENV = String.fromCharCode(
  68, 79, 67, 85, 77, 69, 78, 84, 83, 95, 83, 84, 79, 82, 65, 71, 69,
); // DOCUMENTS_STORAGE

/** קורא משתנה env בלי התאמה סטטית ל־`process.env.NAME` שנקטע בעת transpile של Next. */
function readVolatileEnv(varName: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const v = process.env[varName];
  return typeof v === "string" ? v : undefined;
}

function sanitizeEnvToken(raw: string | undefined): string {
  if (!raw?.length) return "";
  /** BOM / זבל מתבניות עורך הנדבק בשדה משתנה */
  return raw
    .replace(/^\ufeff+/g, "")
    .replace(/\ufeff+/g, "")
    .trim()
    .toLowerCase();
}

/**
 * פרודקשן: `DOCUMENTS_STORAGE=s3` עם `DOCUMENTS_S3_BUCKET` (ואופציונלית נקודת קצה ל־R2/MinIO).
 * פיתוח: ברירת מחדל `local` ותיקיית `LOCAL_UPLOAD_DIR`.
 */
export function getDocumentsStorageBackend(): DocumentsStorageBackend {
  const v = sanitizeEnvToken(readVolatileEnv(DOCUMENTS_STORAGE_ENV));
  if (v === "s3" || v === "r2" || v === "minio") return "s3";
  return "local";
}
