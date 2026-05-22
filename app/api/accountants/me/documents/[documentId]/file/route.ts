import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { getDocumentStorageForAccountant } from "@/lib/accountant/documents-queries";
import { readLocalDocumentByStorageMeta } from "@/lib/uploads/local-store";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { documentId } = await context.params;
  const meta = await getDocumentStorageForAccountant(session.user.id, documentId);
  if (!meta) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }

  if (!/^local\//i.test(meta.storageObjectKey)) {
    return jsonError(
      501,
      "NOT_IMPLEMENTED",
      "הורדה זמינה רק למאגר מקומי (פיתוח).",
    );
  }

  const buf = await readLocalDocumentByStorageMeta({
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
