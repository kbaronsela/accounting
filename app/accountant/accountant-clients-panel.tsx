"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type ClientListRow = {
  id: string;
  displayName: string;
};

type DetailMember = {
  userId: string;
  email: string;
  displayName: string;
  memberRole: string;
};

type DetailInvite = {
  invitationId: string;
  email: string;
  inviteeDisplayName: string | null;
  expiresAt: string;
};

type ClientDetailPayload = {
  client: {
    id: string;
    displayName: string;
    status: string;
  };
  members: DetailMember[];
  pendingInvitations: DetailInvite[];
};

function initialUserRows() {
  return [{ displayName: "", email: "" }];
}

async function fetchClientList(
  search: string,
): Promise<
  | { ok: true; items: ClientListRow[] }
  | { ok: false; message: string }
> {
  const sp = new URLSearchParams();
  if (search.trim().length > 0) {
    sp.set("search", search.trim());
  }
  const qs = sp.toString();
  const url =
    qs.length > 0
      ? `/api/accountants/me/clients?${qs}`
      : "/api/accountants/me/clients";
  const res = await fetch(url);
  const data = (await res.json()) as {
    items?: ClientListRow[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ok: false,
      message: data.error?.message ?? "לא ניתן לטעון את רשימת הלקוחות.",
    };
  }
  return {
    ok: true,
    items: (data.items ?? []).map(({ id, displayName }) => ({ id, displayName })),
  };
}

export function AccountantClientsPanel() {
  const [items, setItems] = useState<ClientListRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchFieldId = useId();

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [clientNameInput, setClientNameInput] = useState("");
  const [newUsers, setNewUsers] = useState(() => initialUserRows());
  const [submitBusy, setSubmitBusy] = useState(false);
  const [newModalErr, setNewModalErr] = useState<string | null>(null);
  const newModalTitleId = useId();

  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const addMemberModalTitleId = useId();
  const [addMemberName, setAddMemberName] = useState("");
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberBusy, setAddMemberBusy] = useState(false);
  const [addMemberErr, setAddMemberErr] = useState<string | null>(null);
  const [addMemberInviteBanner, setAddMemberInviteBanner] = useState<
    | {
        inviteUrl?: string | null;
      }
    | null
  >(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientDetailPayload | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const detailClientTitleId = useId();
  const detailRenameFieldId = useId();

  /** מפתח: `m:userId` או `i:invitationId` */
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  /** כותרת מודאל לקוח: עריכת שם ארגון */
  const [clientDisplayNameEditing, setClientDisplayNameEditing] =
    useState(false);
  const [clientDisplayNameDraft, setClientDisplayNameDraft] = useState("");
  const [clientDisplayNameSaving, setClientDisplayNameSaving] =
    useState(false);

  /** טיוטות עריכה לפי מפתח שורת משתמש/הזמנה */
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; email: string }>
  >({});

  const [sectionBusyKey, setSectionBusyKey] = useState<string | null>(null);
  const [editFlags, setEditFlags] = useState<
    Record<string, { name: boolean; email: boolean }>
  >({});

  const resetNewModal = useCallback(() => {
    setClientNameInput("");
    setNewUsers(initialUserRows());
    setNewModalErr(null);
    setSubmitBusy(false);
  }, []);

  const refreshList = useCallback(async () => {
    const result = await fetchClientList(debouncedSearch);
    if (result.ok) {
      setItems(result.items);
      setListError(null);
    } else {
      setItems([]);
      setListError(result.message);
    }
  }, [debouncedSearch]);

  const isFirstSearchMount = useRef(true);
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (isFirstSearchMount.current) {
      isFirstSearchMount.current = false;
      setDebouncedSearch(trimmed);
      return;
    }
    const t = window.setTimeout(() => setDebouncedSearch(trimmed), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingList(true);
      const result = await fetchClientList(debouncedSearch);
      if (cancelled) return;
      setLoadingList(false);
      if (result.ok) {
        setItems(result.items);
        setListError(null);
      } else {
        setItems([]);
        setListError(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

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
  }, [newModalOpen, resetNewModal]);

  const resetAddMemberModal = useCallback(() => {
    setAddMemberName("");
    setAddMemberEmail("");
    setAddMemberErr(null);
    setAddMemberBusy(false);
  }, []);

  useEffect(() => {
    if (!addMemberModalOpen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        resetAddMemberModal();
        setAddMemberModalOpen(false);
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [addMemberModalOpen, resetAddMemberModal]);

  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailOpen]);

  async function openDetail(clientId: string) {
    setDetailId(clientId);
    setDetailOpen(true);
    setDetail(null);
    setDetailErr(null);
    setDetailLoading(true);
    setExpandedRow(null);
    setDrafts({});
    setEditFlags({});
    setClientDisplayNameEditing(false);
    setClientDisplayNameDraft("");
    setClientDisplayNameSaving(false);
    setAddMemberModalOpen(false);
    resetAddMemberModal();
    setAddMemberInviteBanner(null);

    try {
      const res = await fetch(`/api/accountants/me/clients/${clientId}`);
      const data = (await res.json()) as ClientDetailPayload & {
        error?: { message?: string };
      };
      if (!res.ok) {
        setDetailErr(data.error?.message ?? "לא ניתן לטעון את פרטי הלקוח.");
        setDetailLoading(false);
        return;
      }
      setDetail(data);
    } catch {
      setDetailErr("שגיאת רשת.");
    }
    setDetailLoading(false);
  }

  async function saveClientDisplayName() {
    if (!detail || !detailId) return;
    const name = clientDisplayNameDraft.trim();
    if (!name) {
      setDetailErr("נדרש שם לקוח.");
      return;
    }
    if (name === detail.client.displayName) {
      setClientDisplayNameEditing(false);
      return;
    }
    setDetailErr(null);
    setClientDisplayNameSaving(true);
    try {
      const res = await fetch(`/api/accountants/me/clients/${detailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        client?: { displayName?: string; status?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        setDetailErr(data.error?.message ?? "לא ניתן לעדכן את השם.");
        setClientDisplayNameSaving(false);
        return;
      }
      const nextName = data.client?.displayName ?? name;
      const nextStatus = data.client?.status ?? detail.client.status;
      setDetail((d) =>
        d
          ? {
              ...d,
              client: {
                ...d.client,
                displayName: nextName,
                status: nextStatus,
              },
            }
          : d,
      );
      setClientDisplayNameDraft(nextName);
      setClientDisplayNameEditing(false);
      await refreshList();
    } catch {
      setDetailErr("שגיאת רשת.");
    }
    setClientDisplayNameSaving(false);
  }

  function cancelClientDisplayNameEdit() {
    if (detail) {
      setClientDisplayNameDraft(detail.client.displayName);
    }
    setClientDisplayNameEditing(false);
    setDetailErr(null);
  }

  const closeDetailModal = useCallback(() => {
    setClientDisplayNameEditing(false);
    setClientDisplayNameDraft("");
    setClientDisplayNameSaving(false);
    setExpandedRow(null);
    setDrafts({});
    setEditFlags({});
    setSectionBusyKey(null);
    setAddMemberModalOpen(false);
    resetAddMemberModal();
    setAddMemberInviteBanner(null);
    setDetailOpen(false);
  }, [resetAddMemberModal]);

  useEffect(() => {
    if (!detailOpen || addMemberModalOpen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (clientDisplayNameEditing) {
          cancelClientDisplayNameEdit();
          return;
        }
        closeDetailModal();
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [
    detailOpen,
    addMemberModalOpen,
    clientDisplayNameEditing,
    closeDetailModal,
  ]);

  async function refreshDetailQuiet(clientId: string) {
    setDetailErr(null);
    try {
      const res = await fetch(`/api/accountants/me/clients/${clientId}`);
      const data = (await res.json()) as ClientDetailPayload & {
        error?: { message?: string };
      };
      if (!res.ok) {
        setDetailErr(data.error?.message ?? "לא ניתן לרענן את פרטי הלקוח.");
        return;
      }
      setDetail(data);
    } catch {
      setDetailErr("שגיאת רשת.");
    }
  }

  async function submitAddMember(clientId: string, e: React.FormEvent) {
    e.preventDefault();
    setAddMemberErr(null);
    const email = addMemberEmail.trim().toLowerCase();
    const nameTrim = addMemberName.trim();
    if (!email) {
      setAddMemberErr("נדרשת כתובת אימייל.");
      return;
    }
    setAddMemberBusy(true);
    try {
      const body: Record<string, string | undefined> = { email };
      if (nameTrim.length > 0) {
        body.inviteeDisplayName = nameTrim;
      }
      const res = await fetch(
        `/api/accountants/me/clients/${clientId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        inviteUrl?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        setAddMemberErr(
          data.error?.message ?? `הבקשה נכשלה (${String(res.status)}).`,
        );
        setAddMemberBusy(false);
        return;
      }
      await refreshDetailQuiet(clientId);
      setAddMemberInviteBanner({
        inviteUrl: data.inviteUrl ?? null,
      });
      resetAddMemberModal();
      setAddMemberModalOpen(false);
      await refreshList();
    } catch {
      setAddMemberErr("שגיאת רשת.");
    }
    setAddMemberBusy(false);
  }

  function displayLabelForInvite(inv: DetailInvite) {
    const n = inv.inviteeDisplayName?.trim();
    if (n) return n;
    return inv.email.split("@")[0] ?? inv.email;
  }

  function toggleRow(key: string, name: string, email: string) {
    setDrafts((prev) => ({
      ...prev,
      [key]: prev[key] ?? { name, email },
    }));
    setEditFlags((prev) => ({
      ...prev,
      [key]: prev[key] ?? { name: false, email: false },
    }));
    setExpandedRow((prev) => (prev === key ? null : key));
  }

  async function submitNewClient(e: React.FormEvent) {
    e.preventDefault();
    setNewModalErr(null);
    const name = clientNameInput.trim();
    if (!name) {
      setNewModalErr('נדרש "שם הלקוח".');
      return;
    }
    for (const u of newUsers) {
      if (!u.email.trim()) {
        setNewModalErr("נדרשת כתובת אימייל לכל משתמש.");
        return;
      }
    }

    const usersPayload = newUsers.map((u) => ({
      email: u.email.trim().toLowerCase(),
      inviteeDisplayName: u.displayName.trim() || undefined,
    }));

    setSubmitBusy(true);
    try {
      const res = await fetch("/api/accountants/me/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: name,
          users: usersPayload,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setNewModalErr(data.error?.message ?? "הבקשה נכשלה.");
        setSubmitBusy(false);
        return;
      }
      await refreshList();
      resetNewModal();
      setNewModalOpen(false);
    } catch {
      setNewModalErr("שגיאת רשת.");
    }
    setSubmitBusy(false);
  }

  async function patchMember(clientId: string, userKey: string, userId: string) {
    const draft = drafts[userKey];
    if (!draft) return;
    setDetailErr(null);
    const nm = draft.name.trim();
    const em = draft.email.trim().toLowerCase();
    if (!nm || !em) {
      setDetailErr("חובה שם תצוגה ואימייל לפני שמירה.");
      return;
    }
    setSectionBusyKey(userKey);
    try {
      const body: Record<string, string> = {};
      body.displayName = nm;
      body.email = em;
      const res = await fetch(`/api/accountants/me/clients/${clientId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        member?: { displayName?: string; email?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        setDetailErr(data.error?.message ?? "שגיאה בשמירה.");
        return;
      }
      if (detail) {
        const nextName = data.member?.displayName ?? draft.name.trim();
        const nextEmail = data.member?.email ?? draft.email.trim();
        setDetail({
          ...detail,
          members: detail.members.map((m) =>
            m.userId === userId
              ? {
                  ...m,
                  displayName: nextName,
                  email: nextEmail,
                }
              : m,
          ),
        });
        setDrafts((p) => ({
          ...p,
          [userKey]: { name: nextName, email: nextEmail },
        }));
      }
      setEditFlags((p) => ({ ...p, [userKey]: { name: false, email: false } }));
    } catch {
      setDetailErr("שגיאת רשת.");
    } finally {
      setSectionBusyKey(null);
    }
  }

  async function deleteMember(clientId: string, userKey: string, userId: string) {
    if (!window.confirm("להסיר את המשתמש מהלקוח?")) return;
    setSectionBusyKey(userKey);
    setDetailErr(null);
    try {
      const res = await fetch(`/api/accountants/me/clients/${clientId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setDetailErr(data.error?.message ?? "המחיקה נכשלה.");
      } else if (detail) {
        setDetail({
          ...detail,
          members: detail.members.filter((m) => m.userId !== userId),
        });
        setExpandedRow((k) => (k === userKey ? null : k));
      }
    } catch {
      setDetailErr("שגיאת רשת.");
    } finally {
      setSectionBusyKey(null);
    }
  }

  async function patchInvite(
    clientId: string,
    inviteKey: string,
    invitationId: string,
  ) {
    const draft = drafts[inviteKey];
    if (!draft) return;
    setDetailErr(null);
    const emailNorm = draft.email.trim().toLowerCase();
    if (!emailNorm) {
      setDetailErr("חובה כתובת אימייל לפני שמירה.");
      return;
    }
    setSectionBusyKey(inviteKey);
    try {
      const res = await fetch(
        `/api/accountants/me/clients/${clientId}/invitations/${invitationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviteeDisplayName: draft.name.trim() || undefined,
            email: emailNorm,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        pendingInvitation?: DetailInvite;
        error?: { message?: string };
      };
      if (!res.ok) {
        setDetailErr(data.error?.message ?? "שגיאה בשמירה.");
        return;
      }
      if (detail && data.pendingInvitation) {
        const pi = data.pendingInvitation;
        const invName = pi.inviteeDisplayName?.trim() ?? "";
        const nameDraft =
          invName.length > 0 ? invName : (pi.email.split("@")[0] ?? pi.email);
        setDetail({
          ...detail,
          pendingInvitations: detail.pendingInvitations.map((p) =>
            p.invitationId === invitationId ? pi : p,
          ),
        });
        setDrafts((p) => ({
          ...p,
          [inviteKey]: { name: nameDraft, email: pi.email },
        }));
      }
      setEditFlags((p) => ({ ...p, [inviteKey]: { name: false, email: false } }));
    } catch {
      setDetailErr("שגיאת רשת.");
    } finally {
      setSectionBusyKey(null);
    }
  }

  async function deleteInvite(
    clientId: string,
    inviteKey: string,
    invitationId: string,
  ) {
    if (!window.confirm("לבטל את ההזמנה למשתמש זה?")) return;
    setSectionBusyKey(inviteKey);
    setDetailErr(null);
    try {
      const res = await fetch(
        `/api/accountants/me/clients/${clientId}/invitations/${invitationId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setDetailErr(data.error?.message ?? "המחיקה נכשלה.");
      } else if (detail) {
        setDetail({
          ...detail,
          pendingInvitations: detail.pendingInvitations.filter(
            (p) => p.invitationId !== invitationId,
          ),
        });
        setExpandedRow((k) => (k === inviteKey ? null : k));
      }
    } catch {
      setDetailErr("שגיאת רשת.");
    } finally {
      setSectionBusyKey(null);
    }
  }

  async function deleteClient(clientId: string) {
    if (
      !window.confirm(
        `למחוק את הלקוח «${detail?.client.displayName ?? ""}» ואת כל המסמכים שלו? הפעולה בלתי הפיכית.`,
      )
    ) {
      return;
    }
    setDetailErr(null);
    try {
      const res = await fetch(`/api/accountants/me/clients/${clientId}`, {
        method: "DELETE",
      });
      if (res.status === 204) {
        closeDetailModal();
        await refreshList();
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setDetailErr(data.error?.message ?? "המחיקה נכשלה.");
      }
    } catch {
      setDetailErr("שגיאת רשת.");
    }
  }

  return (
    <div className="w-full max-w-3xl space-y-6 sm:space-y-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-base font-semibold text-zinc-900">ניהול לקוחות</h2>
            <div>
              <label
                htmlFor={searchFieldId}
                className="mb-1 block text-xs font-medium text-zinc-600"
              >
                חיפוש לפי לקוח או משתמש
              </label>
              <input
                id={searchFieldId}
                type="search"
                autoComplete="off"
                placeholder="שם לקוח, כתובת אימייל או שם משתמש…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetNewModal();
              setNewModalOpen(true);
            }}
            className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
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
          <p className="mt-3 text-sm text-zinc-600">
            {debouncedSearch.length > 0
              ? "לא נמצאו לקוחות או משתמשים תואמים לחיפוש."
              : "אין לקוחות עדיין."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
            {items.map((c) => (
              <li key={c.id} className="py-3">
                <button
                  type="button"
                  className="w-full rounded-md px-1 py-2 text-start text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  onClick={() => openDetail(c.id)}
                >
                  {c.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {newModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 pb-10 pt-4 sm:pt-10" dir="rtl">
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
              <h2 id={newModalTitleId} className="text-base font-semibold text-zinc-900 pe-11">
                לקוח חדש
              </h2>
            </div>

            <form onSubmit={submitNewClient} className="flex flex-col gap-4 px-4 py-4 sm:px-5">
              <div>
                <label htmlFor="cpa-new-client-display" className="mb-1 block text-sm font-medium text-zinc-700">
                  שם הלקוח
                </label>
                <input
                  id="cpa-new-client-display"
                  type="text"
                  autoComplete="off"
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  required
                />
              </div>

              <p className="text-sm font-semibold text-zinc-900 border-t border-zinc-100 pt-2">
                משתמשים
              </p>

              <div className="flex flex-col gap-5">
                {newUsers.map((row, idx) => (
                  <div key={`nu-${idx}`} className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3">
                    <div className="mb-3">
                      <label className="mb-1 block text-xs text-zinc-600">
                        שם תצוגה למשתמש
                      </label>
                      <input
                        type="text"
                        value={row.displayName}
                        autoComplete="off"
                        onChange={(e) => {
                          setNewUsers((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, displayName: e.target.value } : r,
                            ),
                          );
                        }}
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-600">
                        כתובת אימייל
                      </label>
                      <input
                        type="email"
                        required={idx === 0}
                        value={row.email}
                        onChange={(e) => {
                          setNewUsers((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, email: e.target.value } : r,
                            ),
                          );
                        }}
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {newUsers.length < 4 ? (
                <button
                  type="button"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  onClick={() =>
                    setNewUsers((rows) => [...rows, { displayName: "", email: "" }])
                  }
                >
                  הוסף משתמש ללקוח
                </button>
              ) : (
                <p className="text-xs text-zinc-500">
                  הגעת למקסימום של ארבעה משתמשים מוזמנים.
                </p>
              )}

              {newModalErr ? (
                <p className="text-sm text-red-700" role="alert">
                  {newModalErr}
                </p>
              ) : null}

              <div className="flex gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="submit"
                  disabled={submitBusy}
                  className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {submitBusy ? "מריצים…" : "בצע"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailOpen && detailId ? (
        <>
          <div
            className="fixed inset-0 z-[101] flex items-start justify-center overflow-y-auto px-4 pb-10 pt-4 sm:pt-10"
            dir="rtl"
          >
            <button
              type="button"
              className="absolute inset-0 bg-zinc-900/50"
              aria-label="סגירה"
              onClick={closeDetailModal}
            />
            <div className="relative z-10 my-4 flex w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-xl sm:my-6 max-h-[min(100vh-2rem,40rem)] sm:max-h-[min(100vh-4rem,48rem)]">
            <div className="relative shrink-0 border-b border-zinc-100 px-4 py-3 sm:px-5">
              <button
                type="button"
                className="absolute end-3 top-3 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
                aria-label="סגירה"
                onClick={closeDetailModal}
              >
                <span aria-hidden className="text-lg leading-none">
                  ×
                </span>
              </button>
              <div className="min-w-0 pe-11">
                {detailLoading ? (
                  <p className="text-sm text-zinc-600">טוענים…</p>
                ) : detail ? (
                  <>
                    {clientDisplayNameEditing ? (
                      <div className="space-y-2">
                        <label
                          htmlFor={detailRenameFieldId}
                          className="text-xs font-medium text-zinc-600"
                        >
                          שם הלקוח
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            id={detailRenameFieldId}
                            type="text"
                            autoComplete="organization"
                            value={clientDisplayNameDraft}
                            disabled={clientDisplayNameSaving}
                            onChange={(e) =>
                              setClientDisplayNameDraft(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelClientDisplayNameEdit();
                              }
                            }}
                            className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100 sm:max-w-[min(100%,28rem)]"
                          />
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              disabled={clientDisplayNameSaving}
                              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
                              onClick={cancelClientDisplayNameEdit}
                            >
                              ביטול
                            </button>
                            <button
                              type="button"
                              disabled={clientDisplayNameSaving}
                              className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                              onClick={() => void saveClientDisplayName()}
                            >
                              {clientDisplayNameSaving ? "שומרים…" : "שמור"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h2
                          id={detailClientTitleId}
                          className="text-base font-semibold text-zinc-900 break-words"
                        >
                          {detail.client.displayName}
                        </h2>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                          onClick={() => {
                            setDetailErr(null);
                            setClientDisplayNameDraft(detail.client.displayName);
                            setClientDisplayNameEditing(true);
                          }}
                        >
                          ערוך שם
                        </button>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">
                      סטטוס: {detail.client.status}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-red-700">{detailErr ?? "שגיאה"}</p>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {detailErr && detail ? (
                <p className="mb-3 text-sm text-red-700" role="alert">
                  {detailErr}
                </p>
              ) : null}

              {detail && !detailLoading ? (
                <div className="space-y-6">
                  <div>
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-800">
                        משתמשים
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          resetAddMemberModal();
                          setAddMemberModalOpen(true);
                        }}
                        className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                      >
                        הוספת משתמש
                      </button>
                    </div>
                    {addMemberInviteBanner ? (
                      <div className="mb-3 rounded-md border border-green-100 bg-green-50/90 p-3 text-sm text-green-950">
                        <p>הוזמנה נוצרה. הקישור בפיתוח (ניתן גם מהלוג):</p>
                        {addMemberInviteBanner.inviteUrl ? (
                          <p className="mt-2 break-all text-xs font-mono text-green-950">
                            {addMemberInviteBanner.inviteUrl}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          className="mt-2 text-xs text-green-900 underline underline-offset-2 hover:text-green-700"
                          onClick={() => setAddMemberInviteBanner(null)}
                        >
                          סגירה
                        </button>
                      </div>
                    ) : null}
                    {detail.members.length === 0 &&
                    detail.pendingInvitations.length === 0 ? (
                      <p className="text-sm text-zinc-600">
                        אין משתמשים או הזמנות ממתינות.
                      </p>
                    ) : null}
                    <ul className="space-y-3">
                      {detail.members.map((m) => {
                        const key = `m:${m.userId}`;
                        const exp = expandedRow === key;
                        const bus = sectionBusyKey === key;
                        const draft = drafts[key] ?? {
                          name: m.displayName,
                          email: m.email,
                        };
                        const edits = editFlags[key] ?? { name: false, email: false };
                        return (
                          <li
                            key={m.userId}
                            className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3"
                          >
                            <button
                              type="button"
                              className="w-full text-start text-sm font-medium text-zinc-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                              onClick={() => toggleRow(key, m.displayName, m.email)}
                            >
                              {m.displayName}
                            </button>
                            {exp ? (
                              <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
                                {edits.name ? (
                                  <div>
                                    <label className="mb-1 block text-xs text-zinc-600">
                                      שם תצוגה למשתמש
                                    </label>
                                    <input
                                      type="text"
                                      value={draft.name}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, name: e.target.value },
                                        }))
                                      }
                                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                                    />
                                  </div>
                                ) : null}
                                <div>
                                  <p className="text-xs font-medium text-zinc-600">כתובת אימייל</p>
                                  {edits.email ? (
                                    <input
                                      type="email"
                                      value={draft.email}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, email: e.target.value },
                                        }))
                                      }
                                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                                    />
                                  ) : (
                                    <p className="mt-1 break-all text-sm text-zinc-800">{draft.email}</p>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  <button
                                    type="button"
                                    disabled={bus}
                                    className="rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                                    onClick={() => deleteMember(detail.client.id, key, m.userId)}
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
                                        [key]: { ...edits, name: true },
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
                                        [key]: { ...edits, email: true },
                                      }))
                                    }
                                  >
                                    ערוך כתובת
                                  </button>
                                  <button
                                    type="button"
                                    disabled={bus}
                                    className="rounded-md bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                                    onClick={() => patchMember(detail.client.id, key, m.userId)}
                                  >
                                    שמור שינויים
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}

                      {detail.pendingInvitations.map((inv) => {
                        const label = displayLabelForInvite(inv);
                        const key = `i:${inv.invitationId}`;
                        const exp = expandedRow === key;
                        const bus = sectionBusyKey === key;
                        const draft =
                          drafts[key] ?? {
                            name: inv.inviteeDisplayName ?? label,
                            email: inv.email,
                          };
                        const edits = editFlags[key] ?? { name: false, email: false };
                        return (
                          <li
                            key={inv.invitationId}
                            className="rounded-lg border border-amber-200 bg-amber-50/70 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-start text-sm font-medium text-zinc-900 hover:underline focus-visible:outline-none"
                                onClick={() =>
                                  toggleRow(
                                    key,
                                    inv.inviteeDisplayName ?? label,
                                    inv.email,
                                  )
                                }
                              >
                                {label}
                              </button>
                              <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-900">
                                הזמנה
                              </span>
                            </div>
                            {exp ? (
                              <div className="mt-3 space-y-3 border-t border-amber-100 pt-3">
                                {edits.name ? (
                                  <div>
                                    <label className="mb-1 block text-xs text-zinc-600">
                                      שם תצוגה למשתמש
                                    </label>
                                    <input
                                      type="text"
                                      value={draft.name}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [key]: {
                                            ...draft,
                                            name: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                                    />
                                  </div>
                                ) : null}
                                <div>
                                  <p className="text-xs font-medium text-zinc-600">כתובת אימייל</p>
                                  {edits.email ? (
                                    <input
                                      type="email"
                                      value={draft.email}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [key]: {
                                            ...draft,
                                            email: e.target.value,
                                          },
                                        }))
                                      }
                                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                                    />
                                  ) : (
                                    <p className="mt-1 break-all text-sm text-zinc-800">{draft.email}</p>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                  <button
                                    type="button"
                                    disabled={bus}
                                    className="rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                                    onClick={() =>
                                      deleteInvite(detail.client.id, key, inv.invitationId)
                                    }
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
                                        [key]: { ...edits, name: true },
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
                                        [key]: { ...edits, email: true },
                                      }))
                                    }
                                  >
                                    ערוך כתובת
                                  </button>
                                  <button
                                    type="button"
                                    disabled={bus}
                                    className="rounded-md bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                                    onClick={() =>
                                      patchInvite(detail.client.id, key, inv.invitationId)
                                    }
                                  >
                                    שמור שינויים
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="border-t border-zinc-100 pt-4">
                    <button
                      type="button"
                      className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
                      onClick={() => deleteClient(detail.client.id)}
                    >
                      מחק לקוח
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

          {addMemberModalOpen && detail ? (
            <div className="fixed inset-0 z-[106] flex items-start justify-center overflow-y-auto px-4 pb-10 pt-4 sm:pt-10">
              <button
                type="button"
                className="absolute inset-0 bg-zinc-900/55"
                aria-label="סגירה"
                onClick={() => {
                  resetAddMemberModal();
                  setAddMemberModalOpen(false);
                }}
              />
              <div className="relative z-10 my-4 flex w-full max-w-md flex-col rounded-xl border border-zinc-200 bg-white shadow-xl">
                <div className="relative shrink-0 border-b border-zinc-100 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    className="absolute end-3 top-3 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
                    aria-label="סגירה"
                    onClick={() => {
                      resetAddMemberModal();
                      setAddMemberModalOpen(false);
                    }}
                  >
                    <span aria-hidden className="text-lg leading-none">
                      ×
                    </span>
                  </button>
                  <h3
                    id={addMemberModalTitleId}
                    className="text-base font-semibold text-zinc-900 pe-11"
                  >
                    משתמש ללקוח «{detail.client.displayName}»
                  </h3>
                  <p className="mt-2 text-xs text-zinc-600">
                    ההזמנה נוצרת לפי האימייל; בפיתוח מוצג הקישור כאן ובלוג השרת.
                  </p>
                </div>
                <form
                  aria-labelledby={addMemberModalTitleId}
                  onSubmit={(e) => submitAddMember(detail.client.id, e)}
                  className="flex flex-col gap-4 px-4 py-4 sm:px-5"
                  dir="rtl"
                >
                  <div>
                    <label
                      htmlFor="cpa-add-member-name"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      שם תצוגה (אופציונלי)
                    </label>
                    <input
                      id="cpa-add-member-name"
                      type="text"
                      autoComplete="off"
                      value={addMemberName}
                      onChange={(e) => setAddMemberName(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="cpa-add-member-email"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      אימייל
                    </label>
                    <input
                      id="cpa-add-member-email"
                      type="email"
                      required
                      autoComplete="off"
                      value={addMemberEmail}
                      onChange={(e) => setAddMemberEmail(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                    />
                  </div>
                  {addMemberErr ? (
                    <p className="text-sm text-red-700" role="alert">
                      {addMemberErr}
                    </p>
                  ) : null}
                  <div className="border-t border-zinc-100 pt-4">
                    <button
                      type="submit"
                      disabled={addMemberBusy}
                      className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                    >
                      {addMemberBusy ? "מריצים…" : "שליחת הזמנה"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
