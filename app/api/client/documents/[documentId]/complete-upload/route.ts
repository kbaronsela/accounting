import { after } from "next/server";
import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { getDocumentForClientMember } from "@/lib/client/document-access";
import { documents } from "@/lib/db/schema";
import { runDocumentOcr } from "@/lib/ocr/run-document-ocr";
import { DOCUMENT_POST_DRAFT_UPLOAD_STATUSES } from "@/lib/document-status-display";
import { uploadedDocumentFileExists } from "@/lib/uploads/document-storage";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

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

  /** כבר עבר זרימת ההעלאה — אידומפוטנטיות (ניסוי חוזר / כפתור השלמה) */
  const alreadyPastDraft = new Set<string>([
    ...DOCUMENT_POST_DRAFT_UPLOAD_STATUSES,
  ]);
  if (alreadyPastDraft.has(doc.status)) {
    return Response.json({ status: doc.status }, { status: 202 });
  }

  if (doc.status !== "draft_uploading") {
    return jsonError(
      409,
      "CONFLICT",
      "המסמך במצב שאינו מאפשר השלמת העלאה.",
    );
  }

  const { exists, size } = await uploadedDocumentFileExists({
    documentId,
    storageObjectKey: doc.storageObjectKey,
  });
  if (!exists) {
    return jsonError(
      400,
      "UPLOAD_MISSING_FILE",
      "לא נשמר קובץ בשרת בשביל הרשומה הזאת — כנראה שלב ההעלאה נקטע לפני שסיימו לשלוח את הקובץ. אפשר למחוק את הטיוטה ולהעלות מחדש מהטופס למעלה.",
      { declaredBytes: doc.byteSize },
    );
  }

  if (size !== doc.byteSize) {
    /** קובץ בפועל ↔ נרשם ב־DB — מיושר כדי שהשערים לא נתקעו (פער במובייל / העלאות לפני תיקון) */
    const nowAlign = new Date();
    await db
      .update(documents)
      .set({ byteSize: size, updatedAt: nowAlign })
      .where(eq(documents.id, documentId));
  }

  const now = new Date();
  await db
    .update(documents)
    .set({ status: "ocr_processing", updatedAt: now })
    .where(eq(documents.id, documentId));

  after(() => {
    runDocumentOcr(documentId).catch((err) => {
      console.error("[document-ocr]", documentId, err);
    });
  });

  return Response.json({ status: "ocr_processing" }, { status: 202 });
}
