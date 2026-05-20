"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type LookupOk = {
  email: string;
  role: string;
  expiresAt: string;
  clientDisplayName: string | null;
};

function InviteFlowInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token")?.trim() ?? "";

  const [lookup, setLookup] = useState<LookupOk | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(true);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLookupError("חסר קישור הזמנה (פרמטר token).");
      setLoadingLookup(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/invitations/lookup?${new URLSearchParams({ token })}`,
        );
        const data = (await res.json()) as LookupOk | { error?: { message?: string } };
        if (!res.ok) {
          const msg =
            "error" in data && data.error?.message
              ? data.error.message
              : "לא ניתן לטעון את ההזמנה.";
          if (!cancelled) setLookupError(msg);
          return;
        }
        if (!cancelled) setLookup(data as LookupOk);
      } catch {
        if (!cancelled) setLookupError("שגיאת רשת.");
      } finally {
        if (!cancelled) setLoadingLookup(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (password.length < 12) {
      setFormError("הסיסמה חייבת להכיל לפחות 12 תווים.");
      return;
    }
    if (password !== password2) {
      setFormError("הסיסמאות אינן תואמות.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, locale: "he" }),
      });
      const data = (await res.json()) as {
        redirectTo?: string;
        error?: { message?: string; code?: string };
      };

      if (!res.ok) {
        setFormError(data.error?.message ?? "לא ניתן להשלים את ההרשמה.");
        setPending(false);
        return;
      }

      const email = lookup?.email ?? "";
      const signRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signRes?.error) {
        setFormError(
          "החשבון נוצר אך ההתחברות האוטומטית נכשלה. נסי להתחבר מדף ההתחברות.",
        );
        setPending(false);
        router.push("/login");
        return;
      }

      router.push(data.redirectTo ?? "/");
    } catch {
      setFormError("שגיאת רשת.");
      setPending(false);
    }
  }

  if (loadingLookup) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
        טוענים את פרטי ההזמנה…
      </div>
    );
  }

  if (lookupError || !lookup) {
    return (
      <div
        className="rounded-md border border-red-200 bg-red-50 p-8 text-sm text-red-800"
        role="alert"
      >
        {lookupError ?? "ההזמנה לא נמצאה."}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 shadow-sm"
      dir="rtl"
    >
      <h1 className="text-lg font-semibold text-zinc-900">השלמת הרשמה</h1>
      <p className="text-sm text-zinc-600">
        מוזמנים כ־{lookup.role === "accountant" ? "רואה חשבון" : "לקוח"}.
        {lookup.clientDisplayName ? (
          <>
            {" "}
            תיק: <strong>{lookup.clientDisplayName}</strong>
          </>
        ) : null}
      </p>
      <p className="text-sm text-zinc-800">
        <span className="text-zinc-500">אימייל: </span>
        {lookup.email}
      </p>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-zinc-700">
          סיסמה (לפחות 12 תווים)
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
      </div>
      <div>
        <label
          htmlFor="password2"
          className="mb-1 block text-sm text-zinc-700"
        >
          אימות סיסמה
        </label>
        <input
          id="password2"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
      </div>
      {formError ? (
        <p className="text-sm text-red-600" role="alert">
          {formError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "יוצרים חשבון…" : "יצירת חשבון והתחברות"}
      </button>
    </form>
  );
}

export function InviteFlow() {
  return (
    <Suspense
      fallback={
        <div className="rounded-md border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
          טוען…
        </div>
      }
    >
      <InviteFlowInner />
    </Suspense>
  );
}
