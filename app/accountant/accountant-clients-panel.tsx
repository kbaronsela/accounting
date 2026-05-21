"use client";

import { useCallback, useEffect, useId, useState } from "react";

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
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const newClientModalTitleId = useId();
  const newClientModalDescId = useId();

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

  useEffect(() => {
    if (!newClientModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setNewClientModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [newClientModalOpen]);

  return (
    <div className="w-full max-w-3xl space-y-6 sm:space-y-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900">תיקי לקוחות</h2>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setInviteUrl(null);
              setNewClientModalOpen(true);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
          >
            לקוח חדש
          </button>
        </div>
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

      {newClientModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 pb-10 pt-4 sm:pt-10"
          dir="rtl"
        >
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/50"
            aria-label="סגירת חלון"
            onClick={() => setNewClientModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={newClientModalTitleId}
            aria-describedby={newClientModalDescId}
            className="relative z-10 my-4 flex max-h-[min(100vh-2rem,42rem)] w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-xl sm:my-6 sm:max-h-[min(100vh-5rem,42rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
              <div className="min-w-0 ps-8 sm:ps-0">
                <h2
                  id={newClientModalTitleId}
                  className="text-base font-semibold text-zinc-900"
                >
                  לקוח חדש
                </h2>
                <p
                  id={newClientModalDescId}
                  className="mt-1 text-sm text-zinc-600"
                >
                  יצירת תיק ללקוח ושליחת קישור להשלמת הרשמה (בהמשך: מייל אוטומטי).
                </p>
              </div>
              <button
                type="button"
                className="absolute start-3 top-3 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                onClick={() => setNewClientModalOpen(false)}
                aria-label="סגירה"
              >
                <span aria-hidden className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>
            <form
              onSubmit={onSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5"
            >
              <div className="flex flex-col gap-3">
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
              </div>
              <div className="mt-4 flex shrink-0 flex-wrap gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setNewClientModalOpen(false)}
                  className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  סגירה
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {pending ? "יוצרים…" : "יצירת תיק והזמנה"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
