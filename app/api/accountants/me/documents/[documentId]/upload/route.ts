import { auth } from "@/auth";
import { getDocumentForAccountantAccess } from "@/lib/accountant/documents-queries";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { UPLOAD_MAX_BYTES } from "@/lib/uploads/config";
import { writeUploadedDocumentFile } from "@/lib/uploads/document-storage";
import { safeS3UpstreamSummary } from "@/lib/uploads/s3-upload-error";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ documentId: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { documentId } = await context.params;
  const doc = await getDocumentForAccountantAccess(session.user.id, documentId);
  if (!doc) {
    return jsonError(404, "NOT_FOUND", "המסמך לא נמצא.");
  }
  if (doc.status !== "draft_uploading") {
    return jsonError(
      409,
      "CONFLICT",
      "המסמך אינו במצב המתאים להעלאה.",
    );
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType && contentType !== doc.mimeType) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "כותרת Content-Type אינה תואמת לסוג המסמך.",
    );
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(await request.arrayBuffer());
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "לא ניתן לקרוא את גוף הבקשה.");
  }

  if (buf.length === 0) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "לא התקבל תוכן קובץ.",
    );
  }
  if (buf.length > UPLOAD_MAX_BYTES) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      `הקובץ חורג מהגודל המרבי (${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} מ״ב).`,
    );
  }
  if (buf.length !== doc.byteSize) {
    await db
      .update(documents)
      .set({ byteSize: buf.length, updatedAt: new Date() })
      .where(eq(documents.id, documentId));
  }

  try {
    await writeUploadedDocumentFile(documentId, doc.storageObjectKey, buf);
  } catch (e) {
    const err = e as Error & { Code?: string; name?: string; $metadata?: unknown };
    const upstream = safeS3UpstreamSummary(e);
    console.error("[accountant-document-upload PUT]", documentId, {
      message: err?.message,
      name: err?.name,
      code: err?.Code,
      metadata: err?.$metadata,
    });
    return jsonError(
      500,
      "UPLOAD_FAILED",
      "שמירת הקובץ נכשלה.",
      upstream ? { upstream } : undefined,
    );
  }

  return new Response(null, { status: 204 });
}
