"use client";

import { useState } from "react";

export function InviteAccountantForm() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setInviteUrl(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/accountants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          displayName: displayName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        inviteUrl?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        setMessage(data.error?.message ?? "הבקשה נכשלה.");
        setPending(false);
        return;
      }
      setMessage(
        "ההזמנה נוצרה. בשלב הפיתוח הקישור מופיע גם בלוג השרת; ניתן להעתיק מכאן:",
      );
      setInviteUrl(data.inviteUrl ?? null);
      setEmail("");
      setDisplayName("");
    } catch {
      setMessage("שגיאת רשת.");
    }
    setPending(false);
  }

  return (
    <div
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
      dir="rtl"
    >
      <h2 className="text-base font-semibold text-zinc-900">
        הזמנת רואה חשבון
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        נשלח קישור להשלמת הרשמה (בהמשך: מייל אוטומטי).
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-4 flex w-full max-w-md flex-col gap-3"
        dir="rtl"
      >
        <div>
          <label htmlFor="inv-email" className="mb-1 block text-sm text-zinc-700">
            אימייל
          </label>
          <input
            id="inv-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label
            htmlFor="inv-name"
            className="mb-1 block text-sm text-zinc-700"
          >
            שם תצוגה (אופציונלי)
          </label>
          <input
            id="inv-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>
        {message ? (
          <p className="text-sm text-zinc-700" role="status">
            {message}
          </p>
        ) : null}
        {inviteUrl ? (
          <p className="break-all rounded-md bg-zinc-100 p-3 text-xs text-zinc-800">
            {inviteUrl}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "שולחים…" : "יצירת הזמנה"}
        </button>
      </form>
    </div>
  );
}
