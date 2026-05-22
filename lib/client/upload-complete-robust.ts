/**
 * לוגיקת השלמת העלאה בדפדפן (ניסויים חוזרים לאחר PUT — רשת / רקע בנייד).
 */

const COMPLETE_UPLOAD_DELAYS_MS = [0, 120, 400, 900, 1800];

type JsonEnvelope = {
  status?: string;
  error?: { message?: string };
};

function extractErrorMessage(body: JsonEnvelope): string | null {
  const m = body.error?.message;
  return typeof m === "string" && m.trim().length > 0 ? m.trim() : null;
}

/** POST complete-upload עם ניסויים חוזרים */
export async function completeUploadRobust(
  documentId: string,
): Promise<{ ok: true } | { ok: false; errorMessage: string | null }> {
  let lastMessage: string | null = null;

  for (let i = 0; i < COMPLETE_UPLOAD_DELAYS_MS.length; i += 1) {
    const wait = COMPLETE_UPLOAD_DELAYS_MS[i] ?? 0;
    if (wait > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, wait);
      });
    }

    let res: Response;
    try {
      res = await fetch(`/api/client/documents/${documentId}/complete-upload`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      lastMessage = "שגיאת רשת בזמן השלמת ההעלאה. יש לנסות שוב בעוד רגע.";
      continue;
    }

    let data: JsonEnvelope = {};
    try {
      data = (await res.json()) as JsonEnvelope;
    } catch {
      /* התגובה לא JSON תקין */
    }

    if (res.ok) {
      return { ok: true };
    }

    lastMessage =
      extractErrorMessage(data) ??
      (res.status >= 500
        ? `שגיאת שרת (${res.status}). מנסים שוב…`
        : `הבקשה נכשלה (${res.status}).`);

    if (
      res.status === 400 ||
      res.status === 403 ||
      res.status === 404 ||
      res.status === 409
    ) {
      return { ok: false, errorMessage: lastMessage };
    }
  }

  return { ok: false, errorMessage: lastMessage };
}
