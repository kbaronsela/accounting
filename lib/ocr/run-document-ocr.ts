import "server-only";

import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { readUploadedDocumentBuffer } from "@/lib/uploads/document-storage";
import { extractDocumentPlainText } from "@/lib/ocr/document-text";
import { SHEKEL_DISPLAY } from "@/lib/client/currency-canonical";
import { extractHeuristicInvoiceFields } from "@/lib/ocr/heuristic-fields";
import { recognizeWithTesseract } from "@/lib/ocr/tesseract-runner";

const OCR_PROVIDER = "tesseract_local";

function isOcrDisabled(): boolean {
  const v = process.env.OCR_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function appendQualityNote(previous: string | null, note: string): string | null {
  const p = previous?.trim() ?? "";
  if (!p) return note;
  if (p.includes(note)) return p;
  return `${p}\n${note}`;
}

/**
 * OCR אסינכרוני למסמך במצב `ocr_processing` — בסיום משבצך ל־`needs_review` או ל־`ocr_failed`.
 */
export async function runDocumentOcr(documentId: string): Promise<void> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc || doc.status !== "ocr_processing") {
    return;
  }

  if (isOcrDisabled()) {
    const now = new Date();
    const note = "OCR מושבת (OCR_DISABLED) — העלאת ידנית של הנתונים.";
    await db
      .update(documents)
      .set({
        status: "uploaded",
        qualityNotes: appendQualityNote(doc.qualityNotes, note),
        updatedAt: now,
        ocrProvider: null,
        extracted: {
          skipped: true,
          reason: "OCR_DISABLED",
          at: now.toISOString(),
        },
      })
      .where(eq(documents.id, documentId));
    return;
  }

  try {
    const buf = await readUploadedDocumentBuffer({
      id: doc.id,
      storageObjectKey: doc.storageObjectKey,
    });
    if (!buf?.length) {
      throw new Error("הקובץ לא נמצא באחסון המסמכים.");
    }

    const extractedPlain = await extractDocumentPlainText({
      mimeType: doc.mimeType,
      buffer: buf,
      onTesseract: recognizeWithTesseract,
    });

    const fields = extractHeuristicInvoiceFields(extractedPlain.text);
    const now = new Date();

    const extractedJson = {
      rawText: extractedPlain.text.slice(0, 50_000),
      source: extractedPlain.source,
      ocrConfidence: extractedPlain.avgConfidence ?? null,
      parsedAt: now.toISOString(),
      heuristic: fields,
    };

    const patch: Partial<typeof documents.$inferInsert> = {
      status: "needs_review",
      updatedAt: now,
      ocrProvider: OCR_PROVIDER,
      extracted: extractedJson,
      extractedAmount: fields.extractedAmount ?? null,
      extractedCurrency: fields.extractedCurrency ?? null,
      extractedDate: fields.extractedDate ?? null,
      extractedVendor: fields.extractedVendor ?? null,
      extractedInvoiceNumber: fields.extractedInvoiceNumber ?? null,
    };

    if (!doc.finalAmount?.trim()) patch.finalAmount = fields.extractedAmount ?? null;
    if (!doc.finalCurrency?.trim()) {
      patch.finalCurrency = SHEKEL_DISPLAY;
    }
    if (!doc.finalDate?.trim()) patch.finalDate = fields.extractedDate ?? null;
    if (!doc.finalVendor?.trim()) patch.finalVendor = fields.extractedVendor ?? null;
    if (!doc.finalInvoiceNumber?.trim()) {
      patch.finalInvoiceNumber = fields.extractedInvoiceNumber ?? null;
    }

    const weakText = extractedPlain.text.trim().length < 24;
    if (weakText) {
      patch.qualityNotes = appendQualityNote(
        doc.qualityNotes,
        "נדלק מעט טקסט — ייתכן מסמך סרוק; יש לוודא את הנתונים לפני שליחת רו״ח.",
      );
    }

    await db.update(documents).set(patch).where(eq(documents.id, documentId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "כשל לא צפוי ב־OCR";
    const now = new Date();
    await db
      .update(documents)
      .set({
        status: "ocr_failed",
        qualityNotes: appendQualityNote(doc.qualityNotes, msg),
        updatedAt: now,
        ocrProvider: OCR_PROVIDER,
        extracted: {
          error: msg.slice(0, 8000),
          at: now.toISOString(),
        },
      })
      .where(eq(documents.id, documentId));
  }
}
