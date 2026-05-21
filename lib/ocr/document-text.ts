import "server-only";

/**
 * משחזר טקסט ממסמך + מידע מה נקרא בשיטה איזו (לביקורת/דיבוג).
 */
export async function extractDocumentPlainText(opts: {
  mimeType: string;
  buffer: Buffer;
  onTesseract: (
    image: Buffer,
  ) => Promise<{ text: string; confidence?: number | null }>;
}): Promise<{
  text: string;
  source: "tesseract-image" | "pdf-text" | "tesseract-pdf-page";
  avgConfidence?: number | null;
}> {
  const { mimeType } = opts;

  if (mimeType === "application/pdf") {
    return extractFromPdf(opts.buffer, opts.onTesseract);
  }

  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/webp"
  ) {
    const r = await opts.onTesseract(opts.buffer);
    return {
      text: r.text,
      source: "tesseract-image",
      avgConfidence: r.confidence ?? null,
    };
  }

  return { text: "", source: "tesseract-image", avgConfidence: null };
}

const MIN_MEANINGFUL_PDF_TEXT_LEN = 48;

async function extractFromPdf(
  buffer: Buffer,
  onTesseract: (
    image: Buffer,
  ) => Promise<{ text: string; confidence?: number | null }>,
): Promise<{
  text: string;
  source: "tesseract-image" | "pdf-text" | "tesseract-pdf-page";
  avgConfidence?: number | null;
}> {
  const mod = await import("pdf-parse");
  const PDFParse = mod.PDFParse as typeof import("pdf-parse").PDFParse;

  const parser = new PDFParse({ data: buffer });
  try {
    const txt = await parser.getText();
    const stripped = txt.text.trim();
    if (stripped.length >= MIN_MEANINGFUL_PDF_TEXT_LEN) {
      return { text: stripped, source: "pdf-text" };
    }

    const shot = await parser.getScreenshot({ first: 1, desiredWidth: 1400 });
    const page0 = shot.pages[0]?.data;
    if (!page0?.length) {
      return { text: stripped, source: "pdf-text" };
    }
    const buf = Buffer.from(page0);
    const r = await onTesseract(buf);
    return {
      text: r.text,
      source: "tesseract-pdf-page",
      avgConfidence: r.confidence ?? null,
    };
  } finally {
    await parser.destroy();
  }
}
