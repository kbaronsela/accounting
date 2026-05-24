import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import { getClientMe } from "@/lib/client/queries";
import { ingestClientUploadedBufferAndStartOcr } from "@/lib/client/ingest-client-upload-from-buffer";
import { guessClientUploadMimeFromFileLike } from "@/lib/uploads/guess-client-upload-mime";
import { createShareStaging } from "@/lib/uploads/share-target-staging";
import { isAllowedUploadMime } from "@/lib/uploads/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rtlPage(title: string, bodyLines: string[]): Response {
  const body = bodyLines.map((l) => `<p>${l}</p>`).join("\n");
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;line-height:1.5;padding:1.25rem;max-width:32rem;margin:auto;background:#fafafa;color:#18181b;}
a{color:#0f766e;font-weight:600;}
</style>
</head>
<body>
<h1>${title}</h1>
${body}
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** קליטת שיתוף (למשל PWA משותף מתוך וואטסאפ במובייל באנדרואיד). */
function firstSharedFile(formData: FormData): File | null {
  const primary = formData.get("shared_file");
  if (primary instanceof File && primary.size > 0) return primary;
  for (const [, v] of formData.entries()) {
    if (v instanceof File && v.size > 0) return v;
  }
  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return rtlPage("נדרשת התחברות", [
      "יש להתחבר כלקוח מהאפליקציה ואז לבצע שיתוף מחדש מתוך Gmail, וואטסאפ וכו׳.",
      `<a href="/login?callbackUrl=/client">התחברות</a>`,
    ]);
  }

  const ctype = request.headers.get("content-type") || "";
  if (!ctype.toLowerCase().includes("multipart/form-data")) {
    return rtlPage("שיתוף לא נתמך", [
      "לא התקבל טופס עם קובץ. נסו לשתף שוב את הקובץ.",
      `<a href="/client">חזרה לאזור הלקוח</a>`,
    ]);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return rtlPage("שגיאה", [
      "לא ניתן לקרוא את הנתונים שנשלחו מהשיתוף.",
      `<a href="/client">חזרה לאזור הלקוח</a>`,
    ]);
  }

  const uploaded = firstSharedFile(formData);
  if (!uploaded) {
    return rtlPage("לא נמצא קובץ", [
      "השיתוף לא כלל קובץ מתאים. נסו לשתף PDF או תמונה.",
      `<a href="/client">חזרה לאזור הלקוח</a>`,
    ]);
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(await uploaded.arrayBuffer());
  } catch {
    return rtlPage("קובץ לא ניתן לקריאה", [
      `<a href="/client">חזרה לאזור הלקוח</a>`,
    ]);
  }

  const mimeGuess = guessClientUploadMimeFromFileLike({
    name: uploaded.name || undefined,
    type: uploaded.type || undefined,
  });
  if (!mimeGuess) {
    return rtlPage("סוג קובץ לא נתמך", [
      "מותר להעלות PDF, JPEG, PNG או WebP.",
      `<a href="/client">חזרה לאזור הלקוח</a>`,
    ]);
  }

  const mimeType =
    uploaded.type?.trim() && isAllowedUploadMime(uploaded.type.trim())
      ? uploaded.type.trim()
      : mimeGuess;

  const me = await getClientMe(session.user.id);
  if (!me || me.clients.length === 0) {
    return rtlPage("אין תיק משויך", [
      "לא ניתן לשמר מסמך בלי תיק משויך למשתמש שלך.",
      `<a href="/client">חזרה לאזור הלקוח</a>`,
    ]);
  }

  const origin = new URL(request.url).origin;

  try {
    if (me.clients.length === 1) {
      const only = me.clients[0];
      const result = await ingestClientUploadedBufferAndStartOcr({
        userId: session.user.id,
        clientId: only.id,
        mimeType,
        buffer: buf,
      });
      if (!result.ok) {
        return rtlPage("לא ניתן לשמר", [
          result.message,
          `<a href="/client">חזרה לאזור הלקוח</a>`,
        ]);
      }
      return Response.redirect(
        `${origin}/client/documents/${result.documentId}`,
        303,
      );
    }

    const { stagingId } = await createShareStaging(session.user.id, buf, {
      mimeType,
      suggestedName: uploaded.name?.trim() || null,
    });

    const next = `${origin}/client/share-finish?sid=${encodeURIComponent(stagingId)}`;
    return Response.redirect(next, 303);
  } catch {
    return rtlPage("שגיאה", [
      "אירעה שגיאה בעיבוד הקובץ. ניתן לנסות שיתוף שוב בעוד רגע.",
      `<a href="/client">חזרה לאזור הלקוח</a>`,
    ]);
  }
}
