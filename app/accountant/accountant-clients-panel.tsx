"use client";

import { useCallback, useEffect, useState } from "react";

type ClientRow = {
  id: string;
  displayName: string;
  status: string;
  memberCount: number;
  createdAt: string;
};

async function fetchClientsList(): Promise<
  | { ok: true; items: ClientRow[] }
  | { ok: false; message: string }
> {
  const res = await fetch("/api/accountants/me/clients");
  const data = (await res.json()) as {
    items?: ClientRow[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ok: false,
      message: data.error?.message ?? "לא ניתן לטעון את רשימת התיקים.",
    };
  }
  return { ok: true, items: data.items ?? [] };
}

export function AccountantClientsPanel() {
  const [items, setItems] = useState<ClientRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteeDisplayName, setInviteeDisplayName] = useState("");
  const [memberRole, setMemberRole] = useState<"primary" | "member">("primary");
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refreshClients = useCallback(async () => {
    const result = await fetchClientsList();
    if (result.ok) {
      setItems(result.items);
      setListError(null);
    } else {
      setListError(result.message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchClientsList();
      if (cancelled) return;
      setLoadingList(false);
      if (result.ok) {
        setItems(result.items);
        setListError(null);
      } else {
        setListError(result.message);
        setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setInviteUrl(null);
    setPending(true);
    try {
      const res = await fetch("/api/accountants/me/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          inviteEmail: inviteEmail.trim().toLowerCase(),
          inviteeDisplayName: inviteeDisplayName.trim() || undefined,
          memberRole,
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
        "נוצר תיק לקוח והזמנה. בשלב הפיתוח ניתן להעתיק את הקישור; הוא מופיע גם בלוג השרת.",
      );
      setInviteUrl(data.inviteUrl ?? null);
      setDisplayName("");
      setInviteEmail("");
      setInviteeDisplayName("");
      setMemberRole("primary");
      await refreshClients();
    } catch {
      setMessage("שגיאת רשת.");
    }
    setPending(false);
  }

  return (
    <div className="w-full max-w-3xl space-y-6 sm:space-y-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-zinc-900">
          תיק לקוח חדש + הזמנה
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          יצירת תיק ללקוח ושליחת קישור להשלמת הרשמה (בהמשך: מייל אוטומטי).
        </p>
        <form
          onSubmit={onSubmit}
          className="mt-4 flex flex-col gap-3"
          dir="rtl"
        >
          <div>
            <label
              htmlFor="cpa-client-name"
              className="mb-1 block text-sm text-zinc-700"
            >
              שם התיק / הלקוח
            </label>
            <input
              id="cpa-client-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label
              htmlFor="cpa-invite-email"
              className="mb-1 block text-sm text-zinc-700"
            >
              אימייל של המוזמן
            </label>
            <input
              id="cpa-invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label
              htmlFor="cpa-invitee-display"
              className="mb-1 block text-sm text-zinc-700"
            >
              שם תצוגה של המוזמן (אופציונלי)
            </label>
            <input
              id="cpa-invitee-display"
              type="text"
              value={inviteeDisplayName}
              onChange={(e) => setInviteeDisplayName(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label
              htmlFor="cpa-member-role"
              className="mb-1 block text-sm text-zinc-700"
            >
              תפקיד במערכת לאחר קבלת ההזמנה
            </label>
            <select
              id="cpa-member-role"
              value={memberRole}
              onChange={(e) =>
                setMemberRole(e.target.value as "primary" | "member")
              }
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              <option value="primary">ראשי תיק (primary)</option>
              <option value="member">חבר נוסף (member)</option>
            </select>
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
            {pending ? "יוצרים…" : "יצירת תיק והזמנה"}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-zinc-900">תיקי לקוחות</h2>
        {loadingList ? (
          <p className="mt-3 text-sm text-zinc-600">טוענים…</p>
        ) : listError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {listError}
          </p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">אין תיקים עדיין.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
            {items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-4 py-3">
                <span className="font-medium text-zinc-900">{c.displayName}</span>
                <span className="text-xs text-zinc-500">{c.status}</span>
                <span className="text-xs text-zinc-500">
                  {c.memberCount} משתמשים במערכת
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
