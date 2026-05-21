"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClientMeClientRow } from "@/lib/client/queries";
import { isAllowedUploadMime } from "@/lib/uploads/config";

function guessMime(file: File): string | null {
  const t = file.type?.trim();
  if (t && isAllowedUploadMime(t)) return t;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}

type Props = {
  clients: ClientMeClientRow[];
};

export function ClientUploadSection({ clients }: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState(
    clients.length === 1 ? clients[0].id : "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (clients.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-zinc-900">העלאת מסמך</h2>
        <p className="mt-2 text-sm text-zinc-600">
          כדי להעלות מסמכים צריך תיק משויך. אם קיבלת הזמנה — השלימי הרשמה מקישור
          ההזמנה.
        </p>
      </section>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!clientId) {
      setError("נא לבחור תיק.");
      return;
    }
    if (!file) {
      setError("נא לבחור קובץ.");
      return;
    }
    const mimeType = guessMime(file);
    if (!mimeType) {
      setError("סוג הקובץ לא נתמך. מותר: PDF, JPEG, PNG, WebP.");
      return;
    }

    setPending(true);
    try {
      const createRes = await fetch("/api/client/documents/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          mimeType,
          byteSize: file.size,
        }),
      });
      const createData = (await createRes.json()) as {
        documentId?: string;
        upload?: {
          url: string;
          method: string;
          headers: Record<string, string>;
        };
        error?: { message?: string };
      };
      if (!createRes.ok) {
        setError(createData.error?.message ?? "יצירת מסמך נכשלה.");
        setPending(false);
        return;
      }
      const upload = createData.upload;
      const documentId = createData.documentId;
      if (!upload?.url || !documentId) {
        setError("תגובת שרת לא צפויה.");
        setPending(false);
        return;
      }

      const putRes = await fetch(upload.url, {
        method: upload.method || "PUT",
        headers: upload.headers || { "Content-Type": mimeType },
        body: file,
      });
      if (!putRes.ok) {
        setError("העלאת הקובץ נכשלה. נסי שוב.");
        setPending(false);
        return;
      }

      const doneRes = await fetch(
        `/api/client/documents/${documentId}/complete-upload`,
        { method: "POST" },
      );
      const doneData = (await doneRes.json()) as {
        status?: string;
        error?: { message?: string };
      };
      if (!doneRes.ok) {
        setError(doneData.error?.message ?? "השלמת ההעלאה נכשלה.");
        setPending(false);
        return;
      }

      setMessage("הקובץ הועלה בהצלחה.");
      setFile(null);
      router.refresh();
    } catch {
      setError("שגיאת רשת.");
    }
    setPending(false);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-zinc-900">העלאת מסמך</h2>
      <p className="mt-1 text-sm text-zinc-600">
        קבלות ומסמכים (PDF או תמונה), עד 20 מ״ב. בפיתוח הקבצים נשמרים בתיקייה
        מקומית (<code className="rounded bg-zinc-100 px-1 text-xs">.data/uploads</code>).
      </p>
      <form
        className="mt-4 flex flex-col gap-3"
        dir="rtl"
        onSubmit={onSubmit}
      >
        {clients.length > 1 ? (
          <div>
            <label
              htmlFor="upload-client"
              className="mb-1 block text-sm text-zinc-700"
            >
              תיק
            </label>
            <select
              id="upload-client"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              <option value="">בחרי תיק…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label
            htmlFor="upload-file"
            className="mb-1 block text-sm text-zinc-700"
          >
            קובץ
          </label>
          <input
            id="upload-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            className="block w-full text-sm text-zinc-600 file:me-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:font-medium file:text-zinc-800"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "מעלים…" : "העלאה"}
        </button>
      </form>
    </section>
  );
}
