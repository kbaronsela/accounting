import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { canAccountantApproveDocument } from "@/lib/accountant/document-edit-policy";
import { getDocumentDetailForAccountant } from "@/lib/accountant/documents-queries";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { auditEvents, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ documentId: string }> };

/** סימון מסמך כאושר — רואה החשבון בלבד, רק מתוך סטטוס «נשלח לרו״ח». */
export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { documentId } = await context.params;
  const row = await getDocumentDetailForAccountant(session.user.id, documentId);
  if (!row) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }

  if (row.status === "approved") {
    return Response.json({ status: "approved", id: documentId }, { status: 200 });
  }

  if (!canAccountantApproveDocument(row.status)) {
    return jsonError(
      409,
      "CONFLICT",
      "ניתן לאשר רק מסמכים שסטטוסם «נשלח לרואה החשבון».",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(documents)
    .set({ status: "approved", updatedAt: now })
    .where(eq(documents.id, documentId))
    .returning({ id: documents.id, status: documents.status });

  if (!updated) {
    return jsonError(500, "INTERNAL", "עדכון הסטטוס נכשל.");
  }

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "document_approved",
    entityType: "document",
    entityId: documentId,
    payloadJson: {
      clientId: row.clientId,
      previousStatus: row.status,
    },
  });

  return Response.json({
    id: updated.id,
    status: updated.status,
  });
}
