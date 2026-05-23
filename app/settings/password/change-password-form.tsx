"use client";

import { useState } from "react";
import { RequiredFieldMark } from "@/app/client/required-field-mark";
import { PasswordField } from "@/components/password-field";

export function ChangePasswordForm({
  hasExistingPassword,
}: {
  hasExistingPassword: boolean;
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
    <div
      className="rounded-xl border border-teal-100/95 bg-white/95 p-4 shadow-[0_8px_30px_-10px_rgb(13_148_136_/_0.12)] sm:p-6"
      dir="rtl"
    >
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-lg font-semibold text-zinc-900">
          {hasExistingPassword ? "החלפת סיסמה" : "הגדרת סיסמה"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">מינימום 12 תווים</p>

        <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmit}>
          {hasExistingPassword ? (
            <div>
              <label
                htmlFor="cur-pw"
                className="mb-1 flex flex-wrap items-center gap-0 text-sm text-zinc-700"
              >
                סיסמה נוכחית
                <RequiredFieldMark />
              </label>
              <PasswordField
                id="cur-pw"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <label
              htmlFor="new-pw"
              className="mb-1 flex flex-wrap items-center gap-0 text-sm text-zinc-700"
            >
              סיסמה חדשה
              <RequiredFieldMark />
            </label>
            <PasswordField
              id="new-pw"
              autoComplete="new-password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="new-pw2"
              className="mb-1 flex flex-wrap items-center gap-0 text-sm text-zinc-700"
            >
              אימות סיסמה חדשה
              <RequiredFieldMark />
            </label>
            <PasswordField
              id="new-pw2"
              autoComplete="new-password"
              required
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
            className="rounded-xl bg-gradient-to-bl from-teal-700 to-emerald-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/25 transition hover:from-teal-800 hover:to-emerald-950 disabled:opacity-60"
          >
            {pending ? "שומרים…" : "שמירה"}
          </button>
        </form>
      </div>
    </div>
  );
}
