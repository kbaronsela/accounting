import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { getDocumentForClientMember } from "@/lib/client/document-access";
import { documents } from "@/lib/db/schema";
import { localDocumentFileExists } from "@/lib/uploads/local-store";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function POST(_request: Request, context: RouteContext) {
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
      "המסמך כבר עבר את שלב ההעלאה.",
    );
  }

  const { exists, size } = await localDocumentFileExists(documentId);
  if (!exists || size !== doc.byteSize) {
    return jsonError(
      400,
      "INCOMPLETE_UPLOAD",
      "הקובץ לא נשמר במלואו. נסי שוב להעלות.",
    );
  }

  const now = new Date();
  await db
    .update(documents)
    .set({ status: "uploaded", updatedAt: now })
    .where(eq(documents.id, documentId));

  return Response.json({ status: "uploaded" }, { status: 202 });
}
