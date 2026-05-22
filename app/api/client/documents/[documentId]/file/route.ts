import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { getDocumentStorageMetaForClient } from "@/lib/client/document-access";
import {
  isManagedDocumentStorageKey,
  readUploadedDocumentBuffer,
} from "@/lib/uploads/document-storage";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת לקוח.");
  }

  const { documentId } = await context.params;
  const meta = await getDocumentStorageMetaForClient(session.user.id, documentId);
  if (!meta) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }

  if (!isManagedDocumentStorageKey(meta.storageObjectKey)) {
    return jsonError(
      501,
      "NOT_IMPLEMENTED",
      "הורדה זמינה רק למאגר הפנימי או ל־S3 (DOCUMENTS_STORAGE).",
    );
  }

  const buf = await readUploadedDocumentBuffer({
    id: meta.id,
    storageObjectKey: meta.storageObjectKey,
  });
  if (!buf) {
    return jsonError(404, "NOT_FOUND", "הקובץ לא נמצא באחסון.");
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": meta.mimeType,
      "Content-Length": String(buf.length),
      "Content-Disposition": `inline; filename="document-${meta.id}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
