"use client";

import { defaultHomePath } from "@/lib/auth/roles";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginFormFields() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(
    error === "forbidden" ? "אין הרשאה לכניסה לאזור זה." : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setPending(true);

    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (res?.error) {
      // Auth.js מסתיר שגיאות callback (למשל כשלי DB) כ-Configuration; רק CredentialsSignin = פרטי התחברות
      setMessage(
        res.error === "CredentialsSignin"
          ? "אימייל או סיסמה שגויים."
          : "לא הצלחנו להשלים את ההתחברות (בעיית שרת). בדקי בלוגי הטרמינל — לעיתים חסרה מיגרציה: הריצי npm run db:migrate",
      );
      setPending(false);
      return;
    }

    const sessionRes = await fetch("/api/auth/session");
    const session = (await sessionRes.json()) as {
      user?: { roles?: string[] };
    } | null;

    window.location.assign(defaultHomePath(session?.user?.roles));
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
      dir="rtl"
    >
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-zinc-700">
          אימייל
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm text-zinc-700"
        >
          סיסמה
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </div>
      {message ? (
        <p className="text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "מתחברים…" : "התחברות"}
      </button>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="h-48 w-full max-w-sm animate-pulse rounded-md bg-zinc-100" />
      }
    >
      <LoginFormFields />
    </Suspense>
  );
}

export function LoginFooterLink() {
  return (
    <Link
      href="/"
      className="text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
    >
      חזרה לדף הבית
    </Link>
  );
}
