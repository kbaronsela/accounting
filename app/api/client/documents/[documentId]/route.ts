import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clients, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canonicalizeCurrency } from "@/lib/client/currency-canonical";
import { getDocumentForClientMember } from "@/lib/client/document-access";
import { isClientDocumentEditable } from "@/lib/client/document-edit-policy";
import { tryNormalizeFinalInvoiceAmountStored } from "@/lib/invoice-final-amount";
import { getPublicAppOrigin } from "@/lib/invitations/public-invite-url";
import { deleteUploadedDocumentAfterDbChange } from "@/lib/uploads/document-storage";
import { z } from "zod";

type RouteContext = { params: Promise<{ documentId: string }> };

async function clientDisplayName(clientId: string): Promise<string | null> {
  const [r] = await db
    .select({ n: clients.displayName })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return r?.n ?? null;
}

function fileBlock(documentId: string, mimeType: string, status: string) {
  if (status === "draft_uploading") return null;
  const base = getPublicAppOrigin();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  return {
    mimeType,
    downloadUrl: `${base}/api/client/documents/${documentId}/file`,
    expiresAt,
  };
}

const patchBodySchema = z
  .object({
    finalAmount: z.union([z.string().max(60), z.null()]).optional(),
    finalCurrency: z.union([z.string().max(12), z.null()]).optional(),
    finalDate: z.union([z.string().max(32), z.null()]).optional(),
    finalVendor: z.union([z.string().max(500), z.null()]).optional(),
    finalInvoiceNumber: z.union([z.string().max(80), z.null()]).optional(),
    clientNote: z.union([z.string().max(4000), z.null()]).optional(),
  })
  .strict();

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת לקוח.");
  }

  const { documentId } = await context.params;
  const doc = await getDocumentForClientMember(session.user.id, documentId);
  if (!doc) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }

  const cname = await clientDisplayName(doc.clientId);

  return Response.json({
    id: doc.id,
    clientId: doc.clientId,
    clientDisplayName: cname,
    status: doc.status,
    finalAmount: doc.finalAmount,
    finalCurrency: canonicalizeCurrency(doc.finalCurrency),
    finalDate: doc.finalDate,
    finalVendor: doc.finalVendor,
    finalInvoiceNumber: doc.finalInvoiceNumber,
    extractedInvoiceNumber: doc.extractedInvoiceNumber,
    clientNote: doc.clientNote,
    extracted: doc.extracted ?? null,
    submittedAt: doc.submittedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    file: fileBlock(doc.id, doc.mimeType, doc.status),
    editable: isClientDocumentEditable(doc.status),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת לקוח.");
  }

  const { documentId } = await context.params;
  const doc = await getDocumentForClientMember(session.user.id, documentId);
  if (!doc) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }
  if (!isClientDocumentEditable(doc.status)) {
    return jsonError(
      409,
      "CONFLICT",
      "לא ניתן לערוך מסמך במצב הנוכחי.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = patchBodySchema.safeParse(body);
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
    if (p.finalAmount === null || p.finalAmount.trim().length === 0) {
      patch.finalAmount = null;
    } else {
      const norm = tryNormalizeFinalInvoiceAmountStored(p.finalAmount.trim());
      if (!norm.ok) {
        return jsonError(
          400,
          "VALIDATION_ERROR",
          "סכום החשבונית אינו מספר תקין.",
        );
      }
      patch.finalAmount = norm.value;
    }
  }
  if (p.finalCurrency !== undefined) {
    patch.finalCurrency =
      p.finalCurrency === null || p.finalCurrency.trim().length === 0
        ? null
        : canonicalizeCurrency(p.finalCurrency.trim());
  }
  if (p.finalDate !== undefined) {
    patch.finalDate =
      p.finalDate === null || p.finalDate.trim().length === 0
        ? null
        : p.finalDate.trim();
  }
  if (p.finalVendor !== undefined) {
    patch.finalVendor =
      p.finalVendor === null || p.finalVendor.trim().length === 0
        ? null
        : p.finalVendor.trim();
  }
  if (p.finalInvoiceNumber !== undefined) {
    patch.finalInvoiceNumber =
      p.finalInvoiceNumber === null ||
      p.finalInvoiceNumber.trim().length === 0
        ? null
        : p.finalInvoiceNumber.trim();
  }
  if (p.clientNote !== undefined) {
    patch.clientNote = p.clientNote === null ? null : p.clientNote.trim() || null;
  }

  const [updated] = await db
    .update(documents)
    .set(patch)
    .where(eq(documents.id, doc.id))
    .returning();

  if (!updated) {
    return jsonError(500, "INTERNAL", "עדכון נכשל.");
  }

  const cname = await clientDisplayName(updated.clientId);

  return Response.json({
    id: updated.id,
    clientId: updated.clientId,
    clientDisplayName: cname,
    status: updated.status,
    finalAmount: updated.finalAmount,
    finalCurrency: canonicalizeCurrency(updated.finalCurrency),
    finalDate: updated.finalDate,
    finalVendor: updated.finalVendor,
    finalInvoiceNumber: updated.finalInvoiceNumber,
    extractedInvoiceNumber: updated.extractedInvoiceNumber,
    clientNote: updated.clientNote,
    extracted: updated.extracted ?? null,
    submittedAt: updated.submittedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    file: fileBlock(updated.id, updated.mimeType, updated.status),
    editable: isClientDocumentEditable(updated.status),
  });
}

/** טיוטת העלאה בלבד — מוחק את הקובץ המקומי אם קיים ואת רשומת המסמך */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת לקוח.");
  }

  const { documentId } = await context.params;
  const doc = await getDocumentForClientMember(session.user.id, documentId);
  if (!doc) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }
  if (doc.status !== "draft_uploading") {
    return jsonError(
      409,
      "CONFLICT",
      "לא ניתן למחוק מסמך שכבר לא ב«טעינת קובץ».",
    );
  }

  await deleteUploadedDocumentAfterDbChange(doc.storageObjectKey, documentId);
  await db.delete(documents).where(eq(documents.id, documentId));

  return new Response(null, { status: 204 });
}
