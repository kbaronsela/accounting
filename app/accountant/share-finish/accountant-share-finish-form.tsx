"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  stagingId: string;
  clients: Array<{ id: string; displayName: string }>;
  suggestedFileName: string | null;
};

export function AccountantShareFinishForm({
  stagingId,
  clients,
  suggestedFileName,
}: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState(
    clients.length === 1 ? clients[0].id : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError("נא לבחור לקוח.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/accountants/me/share-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ stagingId, clientId }),
      });
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      const docId =
        typeof payload === "object" &&
        payload !== null &&
        "documentId" in payload &&
        typeof (payload as { documentId: unknown }).documentId === "string"
          ? (payload as { documentId: string }).documentId
          : null;

      const errMsg =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof (payload as { error?: { message?: string } }).error?.message ===
          "string"
          ? ((payload as { error: { message: string } }).error.message ??
            null)
          : null;

      if (!res.ok || !docId) {
        setError(errMsg ?? "לא ניתן להשלים את ההעלאה. ננסו לשתף שוב.");
        setBusy(false);
        return;
      }
      router.push("/accountant");
    } catch {
      setError("שגיאת רשת. נסו שוב בעוד רגע.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex max-w-lg flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      dir="rtl"
    >
      <div>
        <label
          htmlFor="acct-share-client"
          className="mb-2 block text-sm font-medium text-zinc-900"
        >
          לקוח (תיק)
        </label>
        <select
          id="acct-share-client"
          value={clientId}
          required
          disabled={busy}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">יש לבחור לקוח…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-zinc-600">
        {suggestedFileName ? (
          <>
            מהשיתוף: קובץ <span dir="ltr">{suggestedFileName}</span>.
          </>
        ) : (
          <>הקובץ הועבר בשיתוף — יוצג רשימת המסמכים שלך עם המסמך החדש.</>
        )}
      </p>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {busy ? "מעלה…" : "העלאת המסמך"}
      </button>
    </form>
  );
}
