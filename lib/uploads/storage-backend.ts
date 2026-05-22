import "server-only";

import { readVolatileEnv, trimEnvValue } from "@/lib/uploads/volatile-env";

/**
 * בחירת backend אחסון — הרצת שרת בלבד.
 *
 * בשירות פרוס bundler עלול להחליף `process.env.NAME` סטטי בערך מזמן build.
 * לכן שם המשתנה נבנה בזמן קריאה.
 */

export type DocumentsStorageBackend = "local" | "s3";

function documentsStorageEnvName(): string {
  return String.fromCharCode(
    68, 79, 67, 85, 77, 69, 78, 84, 83, 95, 83, 84, 79, 82, 65, 71, 69,
  );
}

/**
 * פרודקשן: `DOCUMENTS_STORAGE=s3` עם `DOCUMENTS_S3_BUCKET` (ואופציונלית נקודת קצה ל־R2/MinIO).
 * פיתוח: ברירת מחדל `local` ותיקיית `LOCAL_UPLOAD_DIR`.
 */
export function getDocumentsStorageBackend(): DocumentsStorageBackend {
  const v = trimEnvValue(readVolatileEnv(documentsStorageEnvName())).toLowerCase();
  if (v === "s3" || v === "r2" || v === "minio") return "s3";
  return "local";
}
