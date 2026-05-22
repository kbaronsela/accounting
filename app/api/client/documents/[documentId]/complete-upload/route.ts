import { after } from "next/server";
import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { getDocumentForClientMember } from "@/lib/client/document-access";
import { documents } from "@/lib/db/schema";
import { runDocumentOcr } from "@/lib/ocr/run-document-ocr";
import { localDocumentFileExists } from "@/lib/uploads/local-store";
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
  const alreadyPastDraft = new Set([
    "ocr_processing",
    "needs_review",
    "uploaded",
    "ocr_failed",
    "ready_to_submit",
    "submitted",
    "rejected_quality",
    "archived",
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

  const { exists, size } = await localDocumentFileExists(documentId);
  if (!exists) {
    return jsonError(
      400,
      "UPLOAD_MISSING_FILE",
      "לא נשמר קובץ בשרת בשביל הרשומה הזאת — כנראה שלב ההעלאה נקטע לפני שסיימו לשלוח את הקובץ. אפשר למחוק את הטיוטה ולהעלות מחדש מהטופס למעלה.",
      { declaredBytes: doc.byteSize },
    );
  }
  if (size !== doc.byteSize) {
    return jsonError(
      400,
      "UPLOAD_SIZE_MISMATCH",
      `נשמר בשרת קובץ בגודל ${size} בתים, בעוד שנרשם ${doc.byteSize}. יש להעלות מחדש או למחוק את הטיוטה ולהתחיל מחדש.`,
      { storedBytes: size, declaredBytes: doc.byteSize },
    );
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
