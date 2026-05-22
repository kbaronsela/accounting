"use client";

import type { AccountantListItem as AccountantRow } from "@/lib/admin/accountants-types";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

type ClientDispositionChoice = "transfer" | "delete_clients";

function displayLabel(acct: AccountantRow): string {
  const n = acct.displayName?.trim();
  if (n) return n;
  const em = acct.email?.trim();
  if (em) return em.split("@")[0] ?? em;
  return "ללא שם";
}

export function ManageAccountantsPanel({
  initialItems,
}: {
  initialItems: AccountantRow[];
}) {
  const [items, setItems] = useState<AccountantRow[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** מפתח: id רו״ח */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; email: string }>
  >({});
  const [editFlags, setEditFlags] = useState<
    Record<string, { name: boolean; email: boolean }>
  >({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [patchErrById, setPatchErrById] = useState<Record<string, string>>(
    {},
  );

  const [modalAcct, setModalAcct] = useState<AccountantRow | null>(null);
  const [dispose, setDispose] = useState<ClientDispositionChoice>("transfer");
  const [targetId, setTargetId] = useState("");
  const [pending, setPending] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);

  const newModalTitleId = useId();
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newBusy, setNewBusy] = useState(false);
  const [newErr, setNewErr] = useState<string | null>(null);
  const [inviteUrlMsg, setInviteUrlMsg] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

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

  function toggleExpand(acct: AccountantRow) {
    const id = acct.id;
    const label = displayLabel(acct);
    const email = acct.email?.trim() ?? "";
    setDrafts((prev) => ({
      ...prev,
      [id]: prev[id] ?? { name: label, email },
    }));
    setEditFlags((prev) => ({
      ...prev,
      [id]: prev[id] ?? { name: false, email: false },
    }));
    setPatchErrById((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function resetNewModal() {
    setNewEmail("");
    setNewName("");
    setNewErr(null);
    setInviteUrlMsg(null);
    setInviteUrl(null);
    setNewBusy(false);
  }

  useEffect(() => {
    if (!newModalOpen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        resetNewModal();
        setNewModalOpen(false);
      }
    }
    window.addEventListener("keydown", onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [newModalOpen]);

  async function submitNewAccountant(e: React.FormEvent) {
    e.preventDefault();
    setNewErr(null);
    setInviteUrlMsg(null);
    setInviteUrl(null);
    const name = newName.trim();
    const mail = newEmail.trim().toLowerCase();
    if (!name) {
      setNewErr('נדרש "שם".');
      return;
    }
    if (!mail) {
      setNewErr('נדרש "אימייל".');
      return;
    }
    setNewBusy(true);
    try {
      const res = await fetch("/api/admin/accountants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: mail,
          displayName: name,
        }),
      });
      const data = (await res.json()) as {
        inviteUrl?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        setNewErr(data.error?.message ?? "הבקשה נכשלה.");
        setNewBusy(false);
        return;
      }
      setInviteUrlMsg(
        "ההזמנה נוצרה. בשלב הפיתוח הקישור מופיע גם בלוג השרת; ניתן להעתיק מכאן:",
      );
      setInviteUrl(data.inviteUrl ?? null);
      setNewName("");
      setNewEmail("");
      setNewErr(null);
      setNewModalOpen(false);
      setNewBusy(false);
      window.dispatchEvent(new Event("accountants-invites-changed"));
    } catch {
      setNewErr("שגיאת רשת.");
    }
    setNewBusy(false);
  }

  async function patchAccountant(acctId: string) {
    const draft = drafts[acctId];
    if (!draft) return;
    setPatchErrById((prev) => {
      const copy = { ...prev };
      delete copy[acctId];
      return copy;
    });
    const nm = draft.name.trim();
    const em = draft.email.trim().toLowerCase();
    if (!nm || !em) {
      setPatchErrById((prev) => ({
        ...prev,
        [acctId]: "חובה שם תצוגה ואימייל לפני שמירה.",
      }));
      return;
    }
    setRowBusy(acctId);
    try {
      const res = await fetch(`/api/admin/accountants/${acctId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nm, email: em }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: AccountantRow;
        error?: { message?: string };
      };
      if (!res.ok) {
        setPatchErrById((prev) => ({
          ...prev,
          [acctId]:
            data.error?.message ?? `שגיאה בשמירה (${String(res.status)}).`,
        }));
        return;
      }
      if (data.item) {
        setItems((prev) =>
          prev.map((r) =>
            r.id === acctId
              ? {
                  id: data.item!.id,
                  email: data.item!.email ?? null,
                  displayName: data.item!.displayName ?? null,
                  createdAt: data.item!.createdAt ?? r.createdAt,
                  clientCount: Number(data.item!.clientCount ?? r.clientCount),
                }
              : r,
          ),
        );
        const next = data.item;
        const label = displayLabel(next);
        setDrafts((p) => ({
          ...p,
          [acctId]: {
            name: label,
            email: next.email?.trim() ?? "",
          },
        }));
      }
      setEditFlags((p) => ({
        ...p,
        [acctId]: { name: false, email: false },
      }));
    } catch {
      setPatchErrById((prev) => ({
        ...prev,
        [acctId]: "שגיאת רשת.",
      }));
    } finally {
      setRowBusy(null);
    }
  }

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
      setExpandedId((id) => (id === acct.id ? null : id));
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

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) =>
      displayLabel(a).localeCompare(displayLabel(b), "he"),
    );
  }, [items]);

  return (
    <div className="w-full max-w-3xl space-y-6 sm:space-y-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-base font-semibold text-zinc-900">
              ניהול רואי חשבון
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              resetNewModal();
              setNewModalOpen(true);
            }}
            className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            רואה חשבון חדש
          </button>
        </div>

        <p className="mt-2 text-sm text-zinc-600">
          הסרת רואה חשבון מתבצעת דרך «מחק» — עם לקוחות: העברה לרואה חשבון אחר
          או מחיקת כל הלקוחות והמסמכים (לאחר אישור).
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-zinc-600">טוען…</p>
        ) : err ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {err}
          </p>
        ) : sortedItems.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            טרם הוגדרו רואי חשבון. יש ללחוץ על «רואה חשבון חדש» להזמנה.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
            {sortedItems.map((row) => {
              const id = row.id;
              const exp = expandedId === id;
              const bus = rowBusy === id;
              const draft =
                drafts[id] ??
                ({
                  name: displayLabel(row),
                  email: row.email ?? "",
                } as { name: string; email: string });
              const edits = editFlags[id] ?? {
                name: false,
                email: false,
              };
              return (
                <li key={id} className="py-3">
                  <button
                    type="button"
                    className="w-full rounded-md px-1 py-2 text-start text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    onClick={() => toggleExpand(row)}
                  >
                    {displayLabel(row)}
                  </button>
                  {exp ? (
                    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
                      <p className="text-xs font-medium text-zinc-600">
                        מספר לקוחות
                      </p>
                      <p className="mt-1 text-sm text-zinc-900">
                        {row.clientCount}
                      </p>

                      {edits.name ? (
                        <div className="mt-3">
                          <label className="mb-1 block text-xs text-zinc-600">
                            שם תצוגה
                          </label>
                          <input
                            type="text"
                            value={draft.name}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [id]: { ...draft, name: e.target.value },
                              }))
                            }
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                          />
                        </div>
                      ) : null}

                      <div className="mt-3">
                        <p className="text-xs font-medium text-zinc-600">
                          כתובת אימייל
                        </p>
                        {edits.email ? (
                          <input
                            type="email"
                            value={draft.email}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [id]: { ...draft, email: e.target.value },
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                          />
                        ) : (
                          <p className="mt-1 break-all text-sm text-zinc-800">
                            {draft.email ? draft.email : "—"}
                          </p>
                        )}
                      </div>

                      {patchErrById[id] ? (
                        <p
                          className="mt-3 text-sm text-red-700"
                          role="alert"
                        >
                          {patchErrById[id]}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-2 pt-3">
                        <button
                          type="button"
                          disabled={bus}
                          className="rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                          onClick={() => openModal(row)}
                        >
                          מחק
                        </button>
                        <button
                          type="button"
                          disabled={bus}
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                          onClick={() =>
                            setEditFlags((p) => ({
                              ...p,
                              [id]: { ...edits, name: true },
                            }))
                          }
                        >
                          ערוך שם
                        </button>
                        <button
                          type="button"
                          disabled={bus}
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                          onClick={() =>
                            setEditFlags((p) => ({
                              ...p,
                              [id]: { ...edits, email: true },
                            }))
                          }
                        >
                          ערוך כתובת
                        </button>
                        <button
                          type="button"
                          disabled={bus}
                          className="rounded-md bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                          onClick={() => void patchAccountant(id)}
                        >
                          {bus ? "שומרים…" : "שמור שינויים"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {newModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 pb-10 pt-4 sm:pt-10"
          dir="rtl"
        >
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/50"
            aria-label="סגירה"
            onClick={() => {
              resetNewModal();
              setNewModalOpen(false);
            }}
          />
          <div className="relative z-10 my-4 flex w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-xl sm:my-6">
            <div className="relative shrink-0 border-b border-zinc-100 px-4 py-3 sm:px-5">
              <button
                type="button"
                className="absolute end-3 top-3 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="סגירה"
                onClick={() => {
                  resetNewModal();
                  setNewModalOpen(false);
                }}
              >
                <span aria-hidden className="text-lg leading-none">
                  ×
                </span>
              </button>
              <h2
                id={newModalTitleId}
                className="text-base font-semibold text-zinc-900 pe-11"
              >
                רואה חשבון חדש
              </h2>
            </div>

            <form
              onSubmit={submitNewAccountant}
              className="flex flex-col gap-4 px-4 py-4 sm:px-5"
            >
              <div>
                <label
                  htmlFor="admin-new-acct-name"
                  className="mb-1 block text-sm font-medium text-zinc-700"
                >
                  שם
                </label>
                <input
                  id="admin-new-acct-name"
                  type="text"
                  autoComplete="off"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-new-acct-email"
                  className="mb-1 block text-sm font-medium text-zinc-700"
                >
                  אימייל
                </label>
                <input
                  id="admin-new-acct-email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </div>

              {newErr ? (
                <p className="text-sm text-red-700" role="alert">
                  {newErr}
                </p>
              ) : null}

              <div className="flex gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="submit"
                  disabled={newBusy}
                  className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {newBusy ? "יוצרים…" : "יצירת הזמנה"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {inviteUrl ? (
        <div
          role="alert"
          className="fixed bottom-4 end-4 z-[110] max-w-md rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
          dir="rtl"
        >
          <p className="text-sm text-zinc-800">{inviteUrlMsg}</p>
          <p className="mt-2 break-all text-xs text-zinc-900">{inviteUrl}</p>
          <button
            type="button"
            className="mt-2 text-xs text-blue-700 underline"
            onClick={() => {
              setInviteUrl(null);
              setInviteUrlMsg(null);
            }}
          >
            סגירה
          </button>
        </div>
      ) : null}

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
                למשתמש זה אין תיקי לקוח בבעלותו. ההסרה תמחק את תפקיד רואה החשבון
                מהחשבון (אם אין תפקידים נוספים — יימחק משתמש לחלוטין).
              </p>
            ) : (
              <>
                <p className="mt-4 text-sm font-medium text-zinc-900">
                  לרואה החשבון יש <span>{modalAcct.clientCount}</span> תיקים.
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  יש לבחור כיצד לטפל בתיקים לפני הסרת רואה החשבון.
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
                              {displayLabel(o)} ({o.email ?? o.id}){" "}
                              {typeof o.clientCount === "number"
                                ? `· לקוחות: ${o.clientCount}`
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
                      אין ברשימה רואה חשבון אחר אליו ניתן להעביר. אפשר למחוק את
                      התיקים (בלתי הפיך), או להזמין רואה חשבון נוסף ואז להעביר.
                    </p>
                    <p className="mt-3 text-sm text-zinc-700">
                      עם ביצוע ההסרה תוצג תיבת דיאלוג לאישור בדפדפן לפני מחיקת
                      התיקים.
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
                    ? () => void confirmRemoveBare()
                    : () => void confirmWithClients()
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
