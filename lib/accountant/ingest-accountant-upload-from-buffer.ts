import "server-only";

import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { assertAccountantOwnsClient } from "@/lib/accountant/documents-queries";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import {
  newDocumentStorageObjectKey,
  uploadedDocumentFileExists,
  writeUploadedDocumentFile,
} from "@/lib/uploads/document-storage";
import { normalizeUploadBufferToPdfStorage } from "@/lib/uploads/normalize-upload-to-pdf";
import { runDocumentOcr } from "@/lib/ocr/run-document-ocr";
import { UPLOAD_MAX_BYTES } from "@/lib/uploads/config";
import { eq } from "drizzle-orm";

/**
 * יוצר מסמך עבור לקוח של רו״ח, כותב קובץ ומריץ OCR — כמו ingest לקוח אבל מבוסס בעלות רו״ח על התיק.
 * (Share Target בסלולרי וכו׳.)
 */
export async function ingestAccountantUploadedBufferAndStartOcr(options: {
  accountantUserId: string;
  clientId: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ ok: true; documentId: string } | { ok: false; message: string }> {
  const { accountantUserId, clientId, mimeType, buffer } = options;

  if (buffer.length === 0) {
    return { ok: false, message: "לא התקבל תוכן קובץ." };
  }
  if (buffer.length > UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      message: `הקובץ חורג מהגודל המרבי (${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} מ״ב).`,
    };
  }

  const owns = await assertAccountantOwnsClient(accountantUserId, clientId);
  if (!owns) {
    return { ok: false, message: "אין גישה לתיק זה." };
  }

  let storeBuffer = buffer;
  let storeMime = mimeType;

  try {
    const normalized = await normalizeUploadBufferToPdfStorage({
      buffer: storeBuffer,
      declaredMimeType: mimeType,
    });
    storeBuffer = normalized.buffer;
    storeMime = normalized.mimeType;
  } catch {
    return { ok: false, message: "לא ניתן להמיר את הקובץ ל־PDF." };
  }

  if (storeBuffer.length > UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      message: `הקובץ אחרי ההמרה ל־PDF חורג מהגודל המרבי (${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} מ״ב).`,
    };
  }

  const documentId = randomUUID();
  const storageObjectKey = newDocumentStorageObjectKey(documentId);
  const now = new Date();

  await db.insert(documents).values({
    id: documentId,
    clientId,
    uploadedByUserId: accountantUserId,
    storageObjectKey,
    mimeType: storeMime,
    byteSize: storeBuffer.length,
    status: "draft_uploading",
    updatedAt: now,
  });

  try {
    await writeUploadedDocumentFile(documentId, storageObjectKey, storeBuffer);
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
  if (size !== storeBuffer.length) {
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
