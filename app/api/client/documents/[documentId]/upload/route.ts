import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { getDocumentForClientMember } from "@/lib/client/document-access";
import { writeUploadedDocumentFile } from "@/lib/uploads/document-storage";

type RouteContext = { params: Promise<{ documentId: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת לקוח.");
  }

  const { documentId } = await context.params;
  const doc = await getDocumentForClientMember(session.user.id, documentId);
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

  if (buf.length !== doc.byteSize) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      `גודל הקובץ שהתקבל (${buf.length}) אינו תואם לגודל המוצהר (${doc.byteSize}).`,
    );
  }

  try {
    await writeUploadedDocumentFile(documentId, doc.storageObjectKey, buf);
  } catch (e) {
    const err = e as Error & { Code?: string; name?: string; $metadata?: unknown };
    console.error("[document-upload PUT]", documentId, {
      message: err?.message,
      name: err?.name,
      code: err?.Code,
      metadata: err?.$metadata,
    });
    return jsonError(500, "UPLOAD_FAILED", "שמירת הקובץ נכשלה.");
  }

  return new Response(null, { status: 204 });
}
