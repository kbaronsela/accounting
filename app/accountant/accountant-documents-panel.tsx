"use client";

import { useCallback, useEffect, useState } from "react";

type ClientOption = {
  id: string;
  displayName: string;
};

type DocRow = {
  id: string;
  clientId: string;
  clientDisplayName: string;
  status: string;
  finalAmount: string | null;
  finalCurrency: string | null;
  finalVendor: string | null;
  submittedAt: string | null;
  uploadedByEmail: string | null;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft_uploading: "טעינת קובץ",
  uploaded: "הועלה",
  ocr_processing: "עיבוד OCR",
  needs_review: "דורש בדיקה",
  ocr_failed: "כשל ב־OCR",
  ready_to_submit: "מוכן לשליחה לרו״ח",
  submitted: "נשלח לרואה החשבון",
  rejected_quality: "נדחה (איכות)",
  archived: "בארכיון",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

async function fetchClients(): Promise<ClientOption[]> {
  const res = await fetch("/api/accountants/me/clients");
  const data = (await res.json()) as {
    items?: { id: string; displayName: string }[];
  };
  if (!res.ok) return [];
  return (
    data.items?.map((c) => ({ id: c.id, displayName: c.displayName })) ?? []
  );
}

function buildDocsQuery(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v.trim().length === 0) continue;
    sp.set(k, v);
  }
  const q = sp.toString();
  return q.length > 0 ? `?${q}` : "";
}

export function AccountantDocumentsPanel() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientIdFilter, setClientIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  const [items, setItems] = useState<DocRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const c = await fetchClients();
      if (!cancelled) setClients(c);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDocs = useCallback(async () => {
    setListError(null);
    const params: Record<string, string> = { limit: "50" };
    if (clientIdFilter.trim()) params.clientId = clientIdFilter.trim();
    if (statusFilter.trim()) params.status = statusFilter.trim();
    if (onlyNew) params.onlyNew = "true";
    const qs = buildDocsQuery(params);
    try {
      const res = await fetch(`/api/accountants/me/documents${qs}`);
      const data = (await res.json()) as {
        items?: DocRow[];
        error?: { message?: string };
      };
      if (!res.ok) {
        setItems([]);
        setListError(data.error?.message ?? "לא ניתן לטעון מסמכים.");
        setLoading(false);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setItems([]);
      setListError("שגיאת רשת.");
    }
    setLoading(false);
  }, [clientIdFilter, statusFilter, onlyNew]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setLoading(true);
      await loadDocs();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDocs]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-zinc-900">מסמכים מהלקוחות</h2>
      <p className="mt-1 text-sm text-zinc-600">
        מסננים לפי תיק וסטטוס. ברירת המחדל מוצגות רק רשומות שאינן בשלב טעינת
        קובץ; בחרו «הכל» כדי לכלול גם טיוטות בעלאה.
      </p>

      <div
        className="mt-4 flex flex-col gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-4 sm:flex-row sm:flex-wrap sm:items-end"
        dir="rtl"
      >
        <div className="min-w-[11rem] flex-1">
          <label
            htmlFor="acct-docs-client"
            className="mb-1 block text-xs font-medium text-zinc-700"
          >
            תיק
          </label>
          <select
            id="acct-docs-client"
            value={clientIdFilter}
            onChange={(e) => setClientIdFilter(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">כל התיקים</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[11rem]">
          <label
            htmlFor="acct-docs-status"
            className="mb-1 block text-xs font-medium text-zinc-700"
          >
            סטטוס
          </label>
          <select
            id="acct-docs-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">ברירת מחדל (ללא טיוטות)</option>
            <option value="all">הכל כולל טיוטות</option>
            <option value="uploaded">הועלה</option>
            <option value="submitted">נשלח לרואה החשבון</option>
            <option value="needs_review">דורש בדיקה</option>
            <option value="ocr_processing">עיבוד OCR</option>
            <option value="ocr_failed">כשל OCR</option>
          </select>
        </div>
        <label className="flex cursor-pointer flex-wrap items-start gap-2 py-1 text-sm text-zinc-700 md:items-center">
          <input
            type="checkbox"
            checked={onlyNew}
            onChange={(e) => setOnlyNew(e.target.checked)}
            className="rounded border-zinc-400"
          />
          רק חדשים (אחרי «נראה לאחרונה» במסך)
        </label>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-zinc-600">טוענים…</p>
      ) : listError ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {listError}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">
          אין מסמכים להצגה (נסי לשנות מסננים).
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-zinc-200 md:hidden">
            {items.map((d) => (
              <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                <div className="font-medium text-zinc-900">{d.clientDisplayName}</div>
                <dl className="mt-2 space-y-1.5 text-sm text-zinc-600">
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                    <dt className="text-zinc-500">סטטוס</dt>
                    <dd>{statusLabel(d.status)}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                    <dt className="text-zinc-500">סכום</dt>
                    <dd>
                      {d.finalAmount
                        ? `${d.finalAmount}${d.finalCurrency ? ` ${d.finalCurrency}` : ""}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                    <dt className="shrink-0 text-zinc-500">ספק</dt>
                    <dd className="min-w-0 break-words text-end">
                      {d.finalVendor ?? "—"}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                    <dt className="text-zinc-500">נשלח</dt>
                    <dd className="tabular-nums">
                      {d.submittedAt
                        ? new Date(d.submittedAt).toLocaleString("he-IL", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                    <dt className="shrink-0 text-zinc-500">הועלה ע״י</dt>
                    <dd className="min-w-0 break-all text-end text-xs">
                      {d.uploadedByEmail ?? "—"}
                    </dd>
                  </div>
                </dl>
                <a
                  href={`/api/accountants/me/documents/${d.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
                >
                  צפייה בקובץ
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] text-right text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="pb-2 font-medium">תיק</th>
                  <th className="pb-2 font-medium">סטטוס</th>
                  <th className="pb-2 font-medium">סכום</th>
                  <th className="pb-2 font-medium">ספק</th>
                  <th className="pb-2 font-medium">נשלח</th>
                  <th className="pb-2 font-medium">הועלה ע״י</th>
                  <th className="pb-2 font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((d) => (
                  <tr key={d.id} className="text-zinc-800">
                    <td className="py-2.5 font-medium text-zinc-900">
                      {d.clientDisplayName}
                    </td>
                    <td className="py-2.5 text-zinc-600">
                      {statusLabel(d.status)}
                    </td>
                    <td className="py-2.5 text-zinc-600">
                      {d.finalAmount
                        ? `${d.finalAmount}${d.finalCurrency ? ` ${d.finalCurrency}` : ""}`
                        : "—"}
                    </td>
                    <td className="max-w-[12rem] truncate py-2.5 text-zinc-600">
                      {d.finalVendor ?? "—"}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-zinc-500">
                      {d.submittedAt
                        ? new Date(d.submittedAt).toLocaleString("he-IL", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="max-w-[10rem] truncate py-2.5 text-zinc-500">
                      {d.uploadedByEmail ?? "—"}
                    </td>
                    <td className="py-2.5">
                      <a
                        href={`/api/accountants/me/documents/${d.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline-offset-4 hover:underline"
                      >
                        צפייה בקובץ
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
