import "server-only";

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const PDF_MIME = "application/pdf";

async function rasterToSinglePagePdf(
  imageBytes: Buffer,
  kind: "image/jpeg" | "image/png",
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const embedded =
    kind === "image/jpeg"
      ? await pdfDoc.embedJpg(imageBytes)
      : await pdfDoc.embedPng(imageBytes);
  const { width, height } = embedded.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width,
    height,
  });
  const out = await pdfDoc.save();
  return Buffer.from(out);
}

/**
 * שומרים באחסון רק PDF: תמונות מוטמעות בעמוד בודד; PDF נשמר כמו שהועלה.
 * אין חיתוך זיהוי — כל פריים התמונה.
 */
export async function normalizeUploadBufferToPdfStorage(input: {
  buffer: Buffer;
  declaredMimeType: string;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const mime = input.declaredMimeType.trim().toLowerCase();
  const { buffer } = input;

  if (mime === PDF_MIME) {
    return { buffer, mimeType: PDF_MIME };
  }

  if (mime === "image/jpeg") {
    const pdfBuf = await rasterToSinglePagePdf(buffer, "image/jpeg");
    return { buffer: pdfBuf, mimeType: PDF_MIME };
  }

  if (mime === "image/png") {
    const pdfBuf = await rasterToSinglePagePdf(buffer, "image/png");
    return { buffer: pdfBuf, mimeType: PDF_MIME };
  }

  if (mime === "image/webp") {
    const png = await sharp(buffer).png().toBuffer();
    const pdfBuf = await rasterToSinglePagePdf(png, "image/png");
    return { buffer: pdfBuf, mimeType: PDF_MIME };
  }

  throw new Error(`סוג MIME לא נתמך להמרת PDF: ${mime}`);
}
