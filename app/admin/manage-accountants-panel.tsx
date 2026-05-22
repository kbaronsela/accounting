"use client";

import type { AccountantListItem as AccountantRow } from "@/lib/admin/accountants-types";
import { useCallback, useEffect, useMemo, useState } from "react";

type ClientDispositionChoice = "transfer" | "delete_clients";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ManageAccountantsPanel({
  initialItems,
}: {
  initialItems: AccountantRow[];
}) {
  const [items, setItems] = useState<AccountantRow[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [modalAcct, setModalAcct] = useState<AccountantRow | null>(null);
  const [dispose, setDispose] = useState<ClientDispositionChoice>("transfer");
  const [targetId, setTargetId] = useState("");
  const [pending, setPending] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);

  const others = useMemo(
    () => (modalAcct ? items.filter((x) => x.id !== modalAcct.id) : []),
    [items, modalAcct],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/accountants");
      if (!r.ok) {
        throw new Error("fail");
      }
      const data = (await r.json()) as { items: AccountantRow[] };
      setItems(data.items ?? []);
    } catch {
      setErr("לא ניתן לטעון את רשימת רואי החשבון.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function onRefresh() {
      void load();
    }
    window.addEventListener("accountants-invites-changed", onRefresh);
    return () =>
      window.removeEventListener("accountants-invites-changed", onRefresh);
  }, [load]);

  function openModal(acct: AccountantRow) {
    setModalAcct(acct);
    setModalErr(null);
    if (acct.clientCount > 0) {
      const rest = items.filter((x) => x.id !== acct.id);
      if (rest.length > 0) {
        setDispose("transfer");
        setTargetId(rest[0]?.id ?? "");
      } else {
        setDispose("delete_clients");
        setTargetId("");
      }
    } else {
      setDispose("transfer");
      setTargetId("");
    }
  }

  function closeModal() {
    if (pending) return;
    setModalAcct(null);
    setModalErr(null);
  }

  async function executeRemove(
    acct: AccountantRow,
    body: Record<string, unknown>,
  ) {
    setPending(true);
    setModalErr(null);
    try {
      const r = await fetch(`/api/admin/accountants/${acct.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!r.ok) {
        setModalErr(
          data.error?.message ?? `הפעולה נכשלה (${String(r.status)}).`,
        );
        return;
      }
      await load();
      closeModal();
    } catch {
      setModalErr("שגיאת רשת.");
    } finally {
      setPending(false);
    }
  }

  async function confirmRemoveBare() {
    if (!modalAcct || modalAcct.clientCount > 0) return;
    await executeRemove(modalAcct, {});
  }

  async function confirmWithClients() {
    if (!modalAcct || modalAcct.clientCount === 0) return;

    if (dispose === "delete_clients") {
      const ok = window.confirm(
        `בטוח למחוק ${modalAcct.clientCount} תיקי לקוחות וכל המסמכים מהמערכת? הפעולה בלתי הפיכית.`,
      );
      if (!ok) return;
      await executeRemove(modalAcct, { deleteAllClients: true });
      return;
    }

    if (!targetId) {
      setModalErr("יש לבחור רואה חשבון יעד להעברת התיקים.");
      return;
    }
    await executeRemove(modalAcct, {
      transferToAccountantUserId: targetId,
    });
  }

  return (
    <div
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
      dir="rtl"
    >
      <h2 className="text-base font-semibold text-zinc-900">
        ניהול רואי חשבון
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        הסרת רואה חשבון מהמערכת. עם תיקי לקוח — העבר אל רואה חשבון אחר או
        מחק את כל התיקים (בתוספת אישור).
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-zinc-600">טוען…</p>
      ) : err ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">
          טרם הוגדרו רואי חשבון. השתמשי בהזמנה למעלה.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-right text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                <th className="py-2 font-medium">אימייל</th>
                <th className="py-2 font-medium">שם תצוגה</th>
                <th className="py-2 font-medium">נוצר</th>
                <th className="py-2 font-medium">תיקי לקוח</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100">
                  <td className="break-all py-2 text-zinc-900">
                    {row.email ?? "—"}
                  </td>
                  <td className="py-2 text-zinc-800">
                    {row.displayName ?? "—"}
                  </td>
                  <td className="py-2 text-zinc-600">{formatWhen(row.createdAt)}</td>
                  <td className="py-2 text-zinc-800">{row.clientCount}</td>
                  <td className="py-2 text-start">
                    <button
                      type="button"
                      onClick={() => openModal(row)}
                      className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-50"
                    >
                      הסרה מהמערכת
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAcct ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="acct-remove-title"
          dir="rtl"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6">
            <h3
              id="acct-remove-title"
              className="text-lg font-semibold text-zinc-900"
            >
              הסרת רואה חשבון
            </h3>
            <p className="mt-2 break-all text-sm text-zinc-600">
              {modalAcct.email}
              {modalAcct.displayName ? ` · ${modalAcct.displayName}` : null}
            </p>

            {modalAcct.clientCount === 0 ? (
              <p className="mt-4 text-sm text-zinc-700">
                למשתמש זה אין תיקי לקוח בבעלותו. ההסרה תמחק את תפקיד רואה
                החשבון מהחשבון (אם אין תפקידים נוספים — יימחק משתמש לחלוטין).
              </p>
            ) : (
              <>
                <p className="mt-4 text-sm font-medium text-zinc-900">
                  לרואה החשבון יש{" "}
                  <span>{modalAcct.clientCount}</span> תיקים.
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  בחרי כיצד לטפל בתיקים לפני הסרת רואה החשבון.
                </p>

                {others.length > 0 ? (
                  <>
                    <div className="mt-4 space-y-2 text-sm text-zinc-800">
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="radio"
                          name="disp"
                          className="mt-1"
                          checked={dispose === "transfer"}
                          onChange={() => setDispose("transfer")}
                        />
                        <span>העבר את כל התיקים לרואה חשבון אחר</span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="radio"
                          name="disp"
                          className="mt-1"
                          checked={dispose === "delete_clients"}
                          onChange={() => setDispose("delete_clients")}
                        />
                        <span>
                          מחק את כל הלקוחות והתיקים (כל המסמכים מהמערכת)
                        </span>
                      </label>
                    </div>
                    {dispose === "transfer" ? (
                      <label className="mt-4 block text-sm font-medium text-zinc-900">
                        יעד
                        <select
                          value={targetId}
                          onChange={(e) => setTargetId(e.target.value)}
                          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                        >
                          {others.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.email ?? o.id}{" "}
                              {typeof o.clientCount === "number"
                                ? `(תיקים: ${o.clientCount})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-950">
                      אין ברשימה רואה חשבון אחר אליו ניתן להעביר. אפשר למחוק
                      את התיקים (בלתי הפיך), או להזמין רואה חשבון נוסף בטופס
                      למעלה ואז להעביר.
                    </p>
                    <p className="mt-3 text-sm text-zinc-700">
                      כדי למחוק את התיקים לחצי על באישור ההסרה — יופיע דיאלוג
                      אישור מהדפדפן.
                    </p>
                  </>
                )}
              </>
            )}

            {modalErr ? (
              <p className="mt-4 text-sm text-red-700" role="alert">
                {modalErr}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={pending}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={
                  pending ||
                  (modalAcct.clientCount > 0 &&
                    dispose === "transfer" &&
                    others.length > 0 &&
                    !targetId)
                }
                onClick={
                  modalAcct.clientCount === 0
                    ? confirmRemoveBare
                    : confirmWithClients
                }
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {pending ? "מריצים…" : "ביצוע ההסרה"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
