import "server-only";

/**
 * OCR מקומי עם tesseract.js (עברית+אנגלית). כל זיהוי ב-worker נפרד — פשוט ובטוח מבחינת זליגת מצב.
 */
export async function recognizeWithTesseract(
  buffer: Buffer,
): Promise<{ text: string; confidence: number | null }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("heb+eng");
  try {
    const { data } = await worker.recognize(buffer);
    const conf =
      typeof data.confidence === "number" ? data.confidence : null;
    return { text: (data.text ?? "").trim(), confidence: conf };
  } finally {
    await worker.terminate();
  }
}
