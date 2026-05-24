import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { canAccountantEditSubmittedInvoiceFields } from "@/lib/accountant/document-edit-policy";
import {
  getDocumentDeletionContextForAccountant,
  getDocumentDetailForAccountant,
} from "@/lib/accountant/documents-queries";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { canonicalizeCurrency } from "@/lib/client/currency-canonical";
import {
  hasSubmitFieldErrors,
  validateDocumentForSubmit,
} from "@/lib/client/document-submit-validation";
import { db } from "@/lib/db";
import { auditEvents, documents } from "@/lib/db/schema";
import { getPublicAppOrigin } from "@/lib/invitations/public-invite-url";
import { deleteUploadedDocumentAfterDbChange } from "@/lib/uploads/document-storage";
import { eq } from "drizzle-orm";
import { z } from "zod";

type RouteContext = { params: Promise<{ documentId: string }> };

const accountantPatchBodySchema = z
  .object({
    finalAmount: z.string().max(60).optional(),
    finalCurrency: z.string().max(12).optional(),
    finalDate: z.string().max(32).optional(),
    finalVendor: z.string().max(500).optional(),
    finalInvoiceNumber: z.string().max(80).optional(),
    clientNote: z.union([z.string().max(4000), z.null()]).optional(),
  })
  .strict();

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
    finalInvoiceNumber: row.finalInvoiceNumber,
    extractedInvoiceNumber: row.extractedInvoiceNumber,
    clientNote: row.clientNote,
    extracted: row.extracted ?? null,
    submittedAt: row.submittedAt,
    mimeType: row.mimeType,
    editableInvoiceFields: canAccountantEditSubmittedInvoiceFields(row.status),
    file: {
      mimeType: row.mimeType,
      downloadUrl,
      expiresAt,
    },
  });
}

/** עדכון שדות חשבונית למסמך שכבר הוגש לרו״ח */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { documentId } = await context.params;
  const row = await getDocumentDetailForAccountant(session.user.id, documentId);
  if (!row) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }
  if (!canAccountantEditSubmittedInvoiceFields(row.status)) {
    return jsonError(
      409,
      "CONFLICT",
      "עריכת שדות החשבונית זמינה רק למסמכים שכבר נשלחו לרואה החשבון.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = accountantPatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const p = parsed.data;
  const now = new Date();
  const patch: Partial<typeof documents.$inferInsert> = { updatedAt: now };

  if (p.finalAmount !== undefined) {
    patch.finalAmount =
      p.finalAmount.trim().length > 0 ? p.finalAmount.trim() : null;
  }
  if (p.finalCurrency !== undefined) {
    patch.finalCurrency =
      p.finalCurrency.trim().length > 0
        ? canonicalizeCurrency(p.finalCurrency.trim())
        : null;
  }
  if (p.finalDate !== undefined) {
    patch.finalDate =
      p.finalDate.trim().length > 0 ? p.finalDate.trim() : null;
  }
  if (p.finalVendor !== undefined) {
    patch.finalVendor =
      p.finalVendor.trim().length > 0 ? p.finalVendor.trim() : null;
  }
  if (p.finalInvoiceNumber !== undefined) {
    patch.finalInvoiceNumber =
      p.finalInvoiceNumber.trim().length > 0
        ? p.finalInvoiceNumber.trim()
        : null;
  }
  if (p.clientNote !== undefined) {
    patch.clientNote =
      p.clientNote === null ? null : p.clientNote.trim() || null;
  }

  const merged = {
    finalAmount:
      patch.finalAmount !== undefined ? patch.finalAmount : row.finalAmount,
    finalCurrency:
      patch.finalCurrency !== undefined
        ? patch.finalCurrency
        : row.finalCurrency,
    finalDate:
      patch.finalDate !== undefined ? patch.finalDate : row.finalDate,
    finalVendor:
      patch.finalVendor !== undefined ? patch.finalVendor : row.finalVendor,
  };

  const fieldErrors = validateDocumentForSubmit(merged);
  if (hasSubmitFieldErrors(fieldErrors)) {
    return jsonError(
      422,
      "VALIDATION_ERROR",
      "יש לתקן את השדות לפי ההודעות.",
      { fields: fieldErrors },
    );
  }

  const [updated] = await db
    .update(documents)
    .set(patch)
    .where(eq(documents.id, documentId))
    .returning();

  if (!updated) {
    return jsonError(500, "INTERNAL", "עדכון נכשל.");
  }

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "accountant_patch_submitted_document",
    entityType: "document",
    entityId: documentId,
    payloadJson: {
      clientId: row.clientId,
      previousStatus: row.status,
      fieldsUpdated: Object.keys(patch).filter((k) => k !== "updatedAt"),
    },
  });

  const base = getPublicAppOrigin();
  const ttlMs = 15 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const downloadUrl = `${base}/api/accountants/me/documents/${documentId}/file`;

  return Response.json({
    id: updated.id,
    clientId: updated.clientId,
    clientDisplayName: row.clientDisplayName,
    status: updated.status,
    finalAmount: updated.finalAmount,
    finalCurrency: canonicalizeCurrency(updated.finalCurrency),
    finalDate: updated.finalDate,
    finalVendor: updated.finalVendor,
    finalInvoiceNumber: updated.finalInvoiceNumber,
    extractedInvoiceNumber: updated.extractedInvoiceNumber,
    clientNote: updated.clientNote,
    extracted: row.extracted ?? null,
    submittedAt: updated.submittedAt?.toISOString() ?? null,
    mimeType: updated.mimeType,
    editableInvoiceFields: canAccountantEditSubmittedInvoiceFields(
      updated.status,
    ),
    file: {
      mimeType: updated.mimeType,
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
