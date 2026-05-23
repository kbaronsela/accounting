"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useState } from "react";
import { AccountantSubmittedInvoiceEditDialog } from "@/components/accountant-submitted-invoice-edit-dialog";
import { DocumentFileViewerOverlay } from "@/components/document-file-viewer-overlay";
import { canAccountantEditSubmittedInvoiceFields } from "@/lib/accountant/document-edit-policy";

type ClientOption = {
  id: string;
  displayName: string;
};

type DocRow = {
  id: string;
  clientId: string;
  clientDisplayName: string;
  status: string;
  mimeType: string;
  finalAmount: string | null;
  finalCurrency: string | null;
  finalVendor: string | null;
  submittedAt: string | null;
  uploadedByDisplayName: string | null;
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
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [onlyNew, setOnlyNew] = useState(false);
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");
  const [invoiceFrom, setInvoiceFrom] = useState("");
  const [invoiceTo, setInvoiceTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [items, setItems] = useState<DocRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<{
    id: string;
    mimeType: string;
  } | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const filterPanelId = useId();

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

    const fromD = submittedFrom.trim();
    const toD = submittedTo.trim();
    if (fromD && toD && fromD > toD) {
      setItems([]);
      setListError(
        "תאריך הגשה — «מתאריך» חייב להיות לפני או שווה ל־«עד תאריך».",
      );
      setLoading(false);
      return;
    }

    const invFrom = invoiceFrom.trim();
    const invTo = invoiceTo.trim();
    if (invFrom && invTo && invFrom > invTo) {
      setItems([]);
      setListError(
        "תאריך חשבונית — «מתאריך» חייב להיות לפני או שווה ל־«עד תאריך».",
      );
      setLoading(false);
      return;
    }

    const minRaw = minAmount.trim();
    const maxRaw = maxAmount.trim();
    if (minRaw) {
      const n = Number.parseFloat(minRaw.replace(",", "."));
      if (!Number.isFinite(n)) {
        setItems([]);
        setListError("סכום מינימום אינו מספר תקין.");
        setLoading(false);
        return;
      }
    }
    if (maxRaw) {
      const n = Number.parseFloat(maxRaw.replace(",", "."));
      if (!Number.isFinite(n)) {
        setItems([]);
        setListError("סכום מקסימום אינו מספר תקין.");
        setLoading(false);
        return;
      }
    }
    if (minRaw && maxRaw) {
      const lo = Number.parseFloat(minRaw.replace(",", "."));
      const hi = Number.parseFloat(maxRaw.replace(",", "."));
      if (lo > hi) {
        setItems([]);
        setListError("סכום מינימום חייב להיות קטן או שווה לסכום המקסימום.");
        setLoading(false);
        return;
      }
    }

    const params: Record<string, string> = { limit: "50" };
    if (clientIdFilter.trim()) params.clientId = clientIdFilter.trim();
    if (statusFilter.trim()) params.status = statusFilter.trim();
    if (onlyNew) params.onlyNew = "true";
    if (fromD) params.from = fromD;
    if (toD) params.to = toD;
    if (invFrom) params.invoiceFrom = invFrom;
    if (invTo) params.invoiceTo = invTo;
    if (minRaw) params.minAmount = minRaw.replace(",", ".");
    if (maxRaw) params.maxAmount = maxRaw.replace(",", ".");
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
  }, [
    clientIdFilter,
    statusFilter,
    onlyNew,
    submittedFrom,
    submittedTo,
    invoiceFrom,
    invoiceTo,
    minAmount,
    maxAmount,
  ]);

  const handleDeleteDoc = useCallback(async (documentId: string) => {
    if (
      !window.confirm(
        "למחוק את המסמך ואת הקובץ לצמיתות מהמערכת? הפעולה אינה ניתנת לביטול.",
      )
    ) {
      return;
    }
    setDeletingId(documentId);
    setListError(null);
    try {
      const res = await fetch(`/api/accountants/me/documents/${documentId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        let msg = "מחיקה נכשלה.";
        try {
          const data = (await res.json()) as { error?: { message?: string } };
          if (data.error?.message?.trim()) msg = data.error.message.trim();
        } catch {
          msg = `${msg} (קוד ${res.status})`;
        }
        setListError(msg);
        return;
      }
      await loadDocs();
    } catch {
      setListError("שגיאת רשת בעת המחיקה.");
    } finally {
      setDeletingId(null);
    }
  }, [loadDocs]);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900">מסמכים</h2>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
          aria-expanded={filterPanelOpen}
          aria-controls={filterPanelId}
          onClick={() => setFilterPanelOpen((open) => !open)}
        >
          סינון
          <span className="text-zinc-500" aria-hidden>
            {filterPanelOpen ? "▲" : "▼"}
          </span>
        </button>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        מסננים לפי לקוח, סטטוס, <span className="font-medium text-zinc-800">תאריך הגשה</span>
        ו/או <span className="font-medium text-zinc-800">תאריך חשבונית</span> (ערך סופי או מתוצאות
        חילוץ), ו־<span className="font-medium text-zinc-800">סכום סופי</span> במסמך (מספר בלבד;
        מטבעות שונים — לפרש בזהירות). ברירת המחדל: «נשלח לרואה החשבון». לחצו על «סינון» לפתיחת
        המסננים.
      </p>

      {filterPanelOpen ? (
        <div
        id={filterPanelId}
        className="mt-4 space-y-3 rounded-md border border-zinc-100 bg-zinc-50 p-4"
        dir="rtl"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[11rem] flex-1">
            <label
              htmlFor="acct-docs-client"
              className="mb-1 block text-xs font-medium text-zinc-700"
            >
              לקוח
            </label>
            <select
              id="acct-docs-client"
              value={clientIdFilter}
              onChange={(e) => setClientIdFilter(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">כל הלקוחות</option>
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
              <option value="submitted">נשלח לרואה החשבון (ברירת מחדל)</option>
              <option value="">כל הסטטוסים (למעט טעינת קובץ)</option>
              <option value="all">הכל כולל טיוטות</option>
              <option value="uploaded">הועלה</option>
              <option value="ready_to_submit">מוכן לשליחה לרו״ח</option>
              <option value="needs_review">דורש בדיקה</option>
              <option value="ocr_processing">עיבוד OCR</option>
              <option value="ocr_failed">כשל OCR</option>
              <option value="archived">בארכיון</option>
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

        <div className="border-t border-zinc-200 pt-3">
          <p className="mb-2 text-xs font-medium text-zinc-600">תאריך הגשה לרואה החשבון</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:items-end">
            <div>
              <label
                htmlFor="acct-docs-from"
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                הגשה מתאריך
              </label>
              <input
                id="acct-docs-from"
                type="date"
                value={submittedFrom}
                onChange={(e) => setSubmittedFrom(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="acct-docs-to"
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                הגשה עד תאריך
              </label>
              <input
                id="acct-docs-to"
                type="date"
                value={submittedTo}
                onChange={(e) => setSubmittedTo(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-3">
          <p className="mb-2 text-xs font-medium text-zinc-600">תאריך חשבונית</p>
          <p className="mb-2 text-xs text-zinc-500">
            לפי תאריך סופי במסמך; אם אין — לפי תאריך שחולץ אוטומטית. מסמכים בלי תאריך חשבונית לא
            ייכללו בטווח.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:items-end">
            <div>
              <label
                htmlFor="acct-docs-inv-from"
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                חשבונית מתאריך
              </label>
              <input
                id="acct-docs-inv-from"
                type="date"
                value={invoiceFrom}
                onChange={(e) => setInvoiceFrom(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="acct-docs-inv-to"
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                חשבונית עד תאריך
              </label>
              <input
                id="acct-docs-inv-to"
                type="date"
                value={invoiceTo}
                onChange={(e) => setInvoiceTo(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-3">
          <p className="mb-2 text-xs font-medium text-zinc-600">טווח סכומים (סכום סופי במסמך)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="acct-docs-min-amt"
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                סכום מינימום
              </label>
              <input
                id="acct-docs-min-amt"
                type="text"
                inputMode="decimal"
                placeholder="למשל 100"
                autoComplete="off"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="acct-docs-max-amt"
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                סכום מקסימום
              </label>
              <input
                id="acct-docs-max-amt"
                type="text"
                inputMode="decimal"
                placeholder="למשל 5000"
                autoComplete="off"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        </div>
        ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-600">טוענים…</p>
      ) : listError ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {listError}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">
          אין מסמכים להצגה (יש לנסות לשנות מסננים).
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
                      {d.uploadedByDisplayName ?? "—"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-4">
                  {d.status !== "draft_uploading" ? (
                    <button
                      type="button"
                      className="inline-flex text-sm font-semibold text-teal-800 underline-offset-4 transition hover:text-teal-950 hover:underline"
                      onClick={() =>
                        setViewerDoc({ id: d.id, mimeType: d.mimeType })
                      }
                    >
                      צפייה בקובץ
                    </button>
                  ) : (
                    <span className="text-sm text-zinc-400">אין קובץ מוכן</span>
                  )}
                  {canAccountantEditSubmittedInvoiceFields(d.status) ? (
                    <button
                      type="button"
                      className="inline-flex text-sm font-semibold text-teal-800 underline-offset-4 transition hover:text-teal-950 hover:underline"
                      onClick={() => setEditingDocId(d.id)}
                    >
                      עריכה
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={deletingId === d.id}
                    className="inline-flex text-sm font-medium text-red-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      void handleDeleteDoc(d.id);
                    }}
                  >
                    {deletingId === d.id ? "מוחק…" : "מחק"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] text-right text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="pb-2 font-medium">לקוח</th>
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
                      {d.uploadedByDisplayName ?? "—"}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {d.status !== "draft_uploading" ? (
                          <button
                            type="button"
                            className="font-medium text-teal-800 underline-offset-4 transition hover:text-teal-950 hover:underline"
                            onClick={() =>
                              setViewerDoc({
                                id: d.id,
                                mimeType: d.mimeType,
                              })
                            }
                          >
                            צפייה בקובץ
                          </button>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                        {canAccountantEditSubmittedInvoiceFields(d.status) ? (
                          <button
                            type="button"
                            className="font-medium text-teal-800 underline-offset-4 transition hover:text-teal-950 hover:underline"
                            onClick={() => setEditingDocId(d.id)}
                          >
                            עריכה
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={deletingId === d.id}
                          className="text-red-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            void handleDeleteDoc(d.id);
                          }}
                        >
                          {deletingId === d.id ? "מוחק…" : "מחק"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingDocId
        ? createPortal(
            <AccountantSubmittedInvoiceEditDialog
              documentId={editingDocId}
              onClose={() => setEditingDocId(null)}
              onSaved={() => void loadDocs()}
            />,
            document.body,
          )
        : null}

      {viewerDoc
        ? createPortal(
            <DocumentFileViewerOverlay
              viewerKey={viewerDoc.id}
              mimeTypeHint={viewerDoc.mimeType}
              onClose={() => setViewerDoc(null)}
              fetchFile={() =>
                fetch(`/api/accountants/me/documents/${viewerDoc.id}/file`, {
                  credentials: "same-origin",
                  cache: "no-store",
                })
              }
            />,
            document.body,
          )
        : null}
    </div>
  );
}
