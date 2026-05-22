import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import {
  getDocumentDeletionContextForAccountant,
  getDocumentDetailForAccountant,
} from "@/lib/accountant/documents-queries";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { canonicalizeCurrency } from "@/lib/client/currency-canonical";
import { db } from "@/lib/db";
import { auditEvents, documents } from "@/lib/db/schema";
import { getPublicAppOrigin } from "@/lib/invitations/public-invite-url";
import { deleteUploadedDocumentAfterDbChange } from "@/lib/uploads/document-storage";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { documentId } = await context.params;
  const row = await getDocumentDetailForAccountant(session.user.id, documentId);
  if (!row) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }

  const base = getPublicAppOrigin();
  const ttlMs = 15 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const downloadUrl = `${base}/api/accountants/me/documents/${documentId}/file`;

  return Response.json({
    id: row.id,
    clientId: row.clientId,
    clientDisplayName: row.clientDisplayName,
    status: row.status,
    finalAmount: row.finalAmount,
    finalCurrency: canonicalizeCurrency(row.finalCurrency),
    finalDate: row.finalDate,
    finalVendor: row.finalVendor,
    clientNote: row.clientNote,
    extracted: row.extracted ?? null,
    submittedAt: row.submittedAt,
    file: {
      mimeType: row.mimeType,
      downloadUrl,
      expiresAt,
    },
  });
}

/** מחיקה מלאה של מסמך (DB + קובץ מאחסון) למסמך של לקוח ששייך לרואה החשבון */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { documentId } = await context.params;
  const ctx = await getDocumentDeletionContextForAccountant(session.user.id, documentId);
  if (!ctx) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא או שאין הרשאה.");
  }

  try {
    await deleteUploadedDocumentAfterDbChange(ctx.storageObjectKey, documentId);
  } catch (e) {
    console.error("[accountant-delete-document] storage:", documentId, e);
    return jsonError(
      500,
      "STORAGE_DELETE_FAILED",
      "מחיקת הקובץ באחסון נכשלה. נסי שוב או בדקי הרשאות R2.",
    );
  }

  const [gone] = await db
    .delete(documents)
    .where(eq(documents.id, documentId))
    .returning({ id: documents.id });

  if (!gone) {
    return jsonError(500, "INTERNAL", "מחיקת הרשומה נכשלה.");
  }

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "accountant_delete_document",
    entityType: "document",
    entityId: documentId,
    payloadJson: {
      clientId: ctx.clientId,
      previousStatus: ctx.status,
    },
  });

  return new Response(null, { status: 204 });
}
