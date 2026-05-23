"use client";

import { defaultHomePath } from "@/lib/auth/roles";
import { sanitizeAuthCallbackUrl } from "@/lib/auth/callback-url-sanitize";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PasswordField } from "@/components/password-field";
import { RequiredFieldMark } from "@/app/client/required-field-mark";

function loginAlertMessage(errorCode: string | null): string | null {
  if (!errorCode) return null;
  switch (errorCode) {
    case "forbidden":
      return "אין הרשאה לכניסה לאזור זה.";
    case "OAuthInviteRequired":
      return (
        "כניסה עם גוגל אפשרית רק עם מייל שכבר משויך למשתמש (הזמנה או אדמין). " +
        "יש להשלים הרשמה מקישור ההזמנה, ואז ניתן גם עם אותה כתובת ב‑Google."
      );
    case "OAuthMissingEmail":
      return "ספק גוגל לא החזיר כתובת מייל. יש לנסות חשבון אחר.";
    case "OAuthEmailUnverified":
      return "יש לאמת את כתובת המייל בחשבון גוגל לפני ההתחברות.";
    case "AccessDenied":
      return "ההתחברות נחסמה. יש לוודא שהמייל בגוגל תואם לחשבון קיים בהזמנה.";
    default:
      if (errorCode.startsWith("OAuth") || errorCode === "Callback") {
        return "ההתחברות עם ספק חיצוני לא הצליחה. יש לנסות שוב.";
      }
      return null;
  }
}

function LoginFormFields({ googleOAuthEnabled }: { googleOAuthEnabled: boolean }) {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const redirectedMessage = loginAlertMessage(errorCode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldMessage, setFieldMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const postLoginHref = useMemo(
    () => sanitizeAuthCallbackUrl(searchParams.get("callbackUrl")),
    [searchParams],
  );

  function assignAfterSuccessfulSignIn(sessionRoles: string[] | undefined) {
    if (postLoginHref !== "/") {
      window.location.assign(postLoginHref);
      return;
    }
    window.location.assign(defaultHomePath(sessionRoles));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldMessage(null);
    setPending(true);

    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (res?.error) {
      setFieldMessage(
        res.error === "CredentialsSignin"
          ? "אימייל או סיסמה שגויים."
          : "לא הצלחנו להשלים את ההתחברות (בעיית שרת). יש לבדוק בלוגי הטרמינל — לעיתים חסרה מיגרציה; יש להריץ npm run db:migrate",
      );
      setPending(false);
      return;
    }

    const sessionRes = await fetch("/api/auth/session");
    const session = (await sessionRes.json()) as {
      user?: { roles?: string[] };
    } | null;

    assignAfterSuccessfulSignIn(session?.user?.roles);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-5" dir="rtl">
      {redirectedMessage ? (
        <p className="text-sm text-amber-800" role="status">
          {redirectedMessage}
        </p>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="email" className="mb-1 flex flex-wrap items-center gap-0 text-sm text-zinc-700">
            אימייל
            <RequiredFieldMark />
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-teal-200/90 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm outline-none transition focus-visible:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-400/40"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 flex flex-wrap items-center gap-0 text-sm text-zinc-700">
            סיסמה
            <RequiredFieldMark />
          </label>
          <PasswordField
            id="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {fieldMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {fieldMessage}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-bl from-teal-700 to-emerald-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/25 transition hover:from-teal-800 hover:to-emerald-950 disabled:opacity-60"
        >
          {pending ? "מתחברים…" : "התחברות"}
        </button>
      </form>

      {googleOAuthEnabled ? (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs text-zinc-500">
              <span className="bg-white px-2">או</span>
            </div>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              signIn("google", {
                callbackUrl:
                  postLoginHref !== "/" ? postLoginHref : "/login",
              })
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/50 disabled:opacity-60"
          >
            <GoogleGlyph />
            התחברות עם Google
          </button>
        </>
      ) : (
        <p className="text-center text-xs text-zinc-500">
          התחברות עם Google לא מופעלת בסביבה זו (חסרים{" "}
          <code className="rounded bg-zinc-100 px-1 text-[11px]">GOOGLE_CLIENT_ID</code>
          /<code className="rounded bg-zinc-100 px-1 text-[11px]">GOOGLE_CLIENT_SECRET</code>
          ).
        </p>
      )}
    </div>
  );
}

/** לוגו G קטן (סימלי); לא אריזת הרשמה רשמית של Google OAuth */
function GoogleGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginForm({ googleOAuthEnabled }: { googleOAuthEnabled: boolean }) {
  return (
    <Suspense
      fallback={
        <div className="h-48 w-full max-w-sm animate-pulse rounded-md bg-zinc-100" />
      }
    >
      <LoginFormFields googleOAuthEnabled={googleOAuthEnabled} />
    </Suspense>
  );
}

export function LoginFooterLink() {
  return (
    <Link
      href="/"
      className="inline-flex justify-center rounded-lg px-2 py-1.5 text-sm font-medium text-teal-800 underline-offset-4 transition hover:bg-teal-50/80 hover:text-teal-950 hover:underline"
    >
      חזרה לדף הבית
    </Link>
  );
}
