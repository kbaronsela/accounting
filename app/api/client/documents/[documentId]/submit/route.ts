import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { auditEvents, documents } from "@/lib/db/schema";
import { getDocumentForClientMember } from "@/lib/client/document-access";
import { isClientDocumentEditable } from "@/lib/client/document-edit-policy";
import {
  hasSubmitFieldErrors,
  validateDocumentForSubmit,
} from "@/lib/client/document-submit-validation";
import { tryNormalizeFinalInvoiceAmountStored } from "@/lib/invoice-final-amount";
import { randomUUID } from "node:crypto";
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
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }

  if (doc.status === "submitted" || doc.status === "approved") {
    return jsonError(
      409,
      "CONFLICT",
      doc.status === "approved"
        ? "המסמך אושר על ידי רואה החשבון ולא ניתן להגישו מחדש."
        : "המסמך כבר הוגש.",
    );
  }

  if (!isClientDocumentEditable(doc.status)) {
    return jsonError(
      409,
      "CONFLICT",
      "לא ניתן להגיש מסמך במצב הנוכחי.",
    );
  }

  const fields = validateDocumentForSubmit(doc);
  if (hasSubmitFieldErrors(fields)) {
    return jsonError(
      422,
      "VALIDATION_ERROR",
      "יש לתקן את השדות לפי ההודעות.",
      { fields },
    );
  }

  let persistedFinalAmount = doc.finalAmount;
  if (doc.finalAmount?.trim()) {
    const norm = tryNormalizeFinalInvoiceAmountStored(doc.finalAmount);
    persistedFinalAmount =
      norm.ok && norm.value !== null ? norm.value : doc.finalAmount;
  }

  const now = new Date();
  const consumed = await db
    .update(documents)
    .set({
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
      ...(doc.finalAmount?.trim() &&
      persistedFinalAmount !== doc.finalAmount
        ? { finalAmount: persistedFinalAmount }
        : {}),
    })
    .where(
      eq(documents.id, doc.id),
    )
    .returning({
      id: documents.id,
      status: documents.status,
      submittedAt: documents.submittedAt,
    });

  const row = consumed[0];
  if (!row) {
    return jsonError(500, "INTERNAL", "הגשה נכשלה.");
  }

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "document_submitted",
    entityType: "document",
    entityId: row.id,
    payloadJson: { clientId: doc.clientId },
  });

  console.info(
    `[document-submitted] id=${row.id} clientId=${doc.clientId} — מייל/פוש לרו״ח (עתידי)`,
  );

  return Response.json({
    id: row.id,
    status: row.status,
    submittedAt: row.submittedAt!.toISOString(),
  });
}
