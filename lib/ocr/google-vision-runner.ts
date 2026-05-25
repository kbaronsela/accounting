import "server-only";

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";

type VisionResponse = {
  responses?: Array<{
    fullTextAnnotation?: {
      text?: string;
      pages?: Array<{ confidence?: number }>;
    };
    error?: { message?: string; code?: number };
  }>;
};

/**
 * OCR עם Google Cloud Vision API (DOCUMENT_TEXT_DETECTION).
 * עדיף על Tesseract לעברית — כולל כתב יד.
 * דורש משתנה סביבה: GOOGLE_VISION_API_KEY
 */
export async function recognizeWithGoogleVision(
  buffer: Buffer,
): Promise<{ text: string; confidence: number | null }> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GOOGLE_VISION_API_KEY לא מוגדר — הגדר את המשתנה ב-.env.local.",
    );
  }

  const body = {
    requests: [
      {
        image: { content: buffer.toString("base64") },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        imageContext: { languageHints: ["he", "en"] },
      },
    ],
  };

  const res = await fetch(`${VISION_API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Google Vision HTTP ${res.status}: ${txt.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as VisionResponse;
  const response = json.responses?.[0];

  if (response?.error) {
    throw new Error(
      `Google Vision API שגיאה ${response.error.code ?? ""}: ${response.error.message ?? "שגיאה לא ידועה"}`,
    );
  }

  const text = (response?.fullTextAnnotation?.text ?? "").trim();
  const pages = response?.fullTextAnnotation?.pages ?? [];
  const confidence =
    pages.length > 0
      ? pages.reduce((sum, p) => sum + (p.confidence ?? 0), 0) / pages.length
      : null;

  return { text, confidence };
}
