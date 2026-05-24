import "server-only";

import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { clientMembers, documents } from "@/lib/db/schema";
import {
  newDocumentStorageObjectKey,
  uploadedDocumentFileExists,
  writeUploadedDocumentFile,
} from "@/lib/uploads/document-storage";
import { runDocumentOcr } from "@/lib/ocr/run-document-ocr";
import { UPLOAD_MAX_BYTES } from "@/lib/uploads/config";
import { eq, and } from "drizzle-orm";

/**
 * יוצר את רשומת המסמך, כותב את הקובץ, ומתחיל OCR — בשורה אחת בשרת
 * (למשל השלמה מהשיתוף אחרי multipart מ־share_target או מהשלב «בחרי תיק»).
 */
export async function ingestClientUploadedBufferAndStartOcr(options: {
  userId: string;
  clientId: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ ok: true; documentId: string } | { ok: false; message: string }> {
  const { userId, clientId, mimeType, buffer } = options;

  if (buffer.length === 0) {
    return { ok: false, message: "לא התקבל תוכן קובץ." };
  }
  if (buffer.length > UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      message: `הקובץ חורג מהגודל המרבי (${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} מ״ב).`,
    };
  }

  const [member] = await db
    .select({ clientId: clientMembers.clientId })
    .from(clientMembers)
    .where(
      and(
        eq(clientMembers.clientId, clientId),
        eq(clientMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!member) {
    return { ok: false, message: "אין גישה לתיק זה." };
  }

  const documentId = randomUUID();
  const storageObjectKey = newDocumentStorageObjectKey(documentId);
  const now = new Date();

  await db.insert(documents).values({
    id: documentId,
    clientId,
    uploadedByUserId: userId,
    storageObjectKey,
    mimeType,
    byteSize: buffer.length,
    status: "draft_uploading",
    updatedAt: now,
  });

  try {
    await writeUploadedDocumentFile(documentId, storageObjectKey, buffer);
  } catch {
    await db.delete(documents).where(eq(documents.id, documentId));
    return { ok: false, message: "שמירת הקובץ נכשלה." };
  }

  const { exists, size } = await uploadedDocumentFileExists({
    documentId,
    storageObjectKey,
  });
  if (!exists) {
    await db.delete(documents).where(eq(documents.id, documentId));
    return { ok: false, message: "הקובץ לא נשמר אחרי ההעלאה." };
  }
  const alignNow = new Date();
  if (size !== buffer.length) {
    await db
      .update(documents)
      .set({ byteSize: size, updatedAt: alignNow })
      .where(eq(documents.id, documentId));
  }

  await db
    .update(documents)
    .set({ status: "ocr_processing", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  after(() => {
    runDocumentOcr(documentId).catch((err) => {
      console.error("[document-ocr]", documentId, err);
    });
  });

  return { ok: true, documentId };
}
