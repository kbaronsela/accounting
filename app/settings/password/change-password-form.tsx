"use client";

import Link from "next/link";
import { useState } from "react";
import { PasswordField } from "@/components/password-field";

export function ChangePasswordForm({
  hasExistingPassword,
  defaultReturnHref,
}: {
  hasExistingPassword: boolean;
  /** דף הנחיתת ברירת מחדל לפי תפקיד */
  defaultReturnHref: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== newPassword2) {
      setError("הסיסמה החדשה ואימות הסיסמה אינן תואמות.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(hasExistingPassword ? { currentPassword } : {}),
          newPassword,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };

      if (!res.ok) {
        setError(data.error?.message ?? "לא ניתן לעדכן את הסיסמה.");
        setPending(false);
        return;
      }

      setMessage(
        hasExistingPassword
          ? "הסיסמה עודכנה בהצלחה."
          : "סיסמה הוגדרה בהצלחה. מאפשרת גם התחברות באימייל וסיסמה.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setNewPassword2("");
    } catch {
      setError("שגיאת רשת.");
    }
    setPending(false);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6" dir="rtl">
      <h1 className="text-lg font-semibold text-zinc-900">
        {hasExistingPassword ? "החלפת סיסמה" : "הגדרת סיסמה"}
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        {hasExistingPassword
          ? "אם נכנסת גם עם גוגל או עם סיסמה, כאן מעדכנים את סיסמת האימות."
          : "אין לך עדיין סיסמה במערכת (למשל אחרי כניסה עם גוגל). ניתן להגדרת סיסמה לגיבוי והתחברות באימייל."}{" "}
        מינימום 12 תווים.
      </p>

      <form className="mt-6 flex max-w-md flex-col gap-3" onSubmit={onSubmit}>
        {hasExistingPassword ? (
          <div>
            <label htmlFor="cur-pw" className="mb-1 block text-sm text-zinc-700">
              סיסמה נוכחית
            </label>
            <PasswordField
              id="cur-pw"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="new-pw" className="mb-1 block text-sm text-zinc-700">
            סיסמה חדשה
          </label>
          <PasswordField
            id="new-pw"
            autoComplete="new-password"
            minLength={12}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new-pw2" className="mb-1 block text-sm text-zinc-700">
            אימות סיסמה חדשה
          </label>
          <PasswordField
            id="new-pw2"
            autoComplete="new-password"
            minLength={12}
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
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
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "שומרים…" : "שמירה"}
        </button>
      </form>

      <p className="mt-6">
        <Link
          href={defaultReturnHref}
          className="text-sm text-blue-700 underline-offset-4 hover:underline"
        >
          חזרה לאזור שלי
        </Link>
        {" · "}
        <Link href="/" className="text-sm text-blue-700 underline-offset-4 hover:underline">
          דף הבית
        </Link>
      </p>
    </div>
  );
}
