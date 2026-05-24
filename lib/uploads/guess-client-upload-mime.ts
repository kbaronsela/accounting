import { isAllowedUploadMime } from "@/lib/uploads/config";

/** זיהוי סוג מהקובץ (ספק לא תמיד שולח `type` בשיתוף ממוביל). */
export function guessClientUploadMimeFromFileLike(file: {
  name?: string;
  type?: string;
}): string | null {
  const t = file.type?.trim();
  if (t && isAllowedUploadMime(t)) return t;
  const name = file.name?.toLowerCase().trim();
  if (!name) return null;
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}
