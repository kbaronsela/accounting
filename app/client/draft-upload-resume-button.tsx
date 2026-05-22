"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeUploadRobust } from "@/lib/client/upload-complete-robust";

/** כפתורי טיוטה תקועה: השלמת complete-upload או מחיקת הרשומה כדי להעלות מחדש */
export function DraftUploadResumeButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onResume() {
    setMessage(null);
    setBusy(true);
    const r = await completeUploadRobust(documentId);
    setBusy(false);
    if (!r.ok) {
      setMessage(r.errorMessage ?? "לא הצליח להשלים.");
      return;
    }
    router.refresh();
  }

  async function onDiscardDraft() {
    if (
      !window.confirm(
        "למחוק את הרשומה מהרשימה? אם לא נשמר קובץ בשרת לא תאבדי כלום. אחרי זה אפשר להעלות שוב מהטופס.",
      )
    ) {
      return;
    }
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/client/documents/${documentId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.status !== 204) {
        let msg = `מחיקה נכשלה (${res.status}).`;
        try {
          const body = (await res.json()) as {
            error?: { message?: string };
          };
          if (body.error?.message) msg = body.error.message;
        } catch {
          /* ריק */
        }
        setMessage(msg);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setMessage("שגיאת רשת בזמן המחיקה.");
    }
    setBusy(false);
  }

  return (
    <div
      role="presentation"
      className="space-y-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => void onResume()}
        className="rounded-md border border-amber-800 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
      >
        {busy ? "מבצעים…" : "להשלים העלאה"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onDiscardDraft()}
        className="block w-full rounded-md border border-transparent px-3 py-1 text-xs font-medium text-red-800 underline underline-offset-2 hover:text-red-950 disabled:opacity-60 sm:w-auto"
      >
        מחיקת טיוטת העלאה מהרשימה
      </button>
      <p className="text-[11px] text-zinc-500">
        «להשלים» עוזר רק כשכבר הגיע הקובץ לשרת והשלב האחרון נקטע.
        אם מופיעה שגיאה על קובץ חסר — יש להשתמש במחיקה ולהעלות מחדש.
      </p>
      {message ? (
        <p className="text-xs text-red-600" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
