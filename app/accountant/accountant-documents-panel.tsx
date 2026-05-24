"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { AccountantSubmittedInvoiceEditDialog } from "@/components/accountant-submitted-invoice-edit-dialog";
import { DocumentFileViewerOverlay } from "@/components/document-file-viewer-overlay";
import {
  canAccountantApproveDocument,
  canAccountantEditSubmittedInvoiceFields,
} from "@/lib/accountant/document-edit-policy";
import {
  appModalCloseButtonClass,
  appModalGhostButtonClass,
  appModalHeaderClass,
} from "@/lib/ui/modal-classes";
import { documentStatusRowSurfaceClass } from "@/lib/ui/document-status-row-classes";

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
  approved: "אושר",
  rejected_quality: "נדחה (איכות)",
  archived: "בארכיון",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

type AccountantDocsSortKey =
  | "client"
  | "status"
  | "amount"
  | "vendor"
  | "submitted"
  | "uploadedBy";

type AccountantDocsSortState = {
  key: AccountantDocsSortKey;
  dir: "asc" | "desc";
};

/** מיון דיפולט: נשלח — יורד (הכי מאוחר ראשון) */
const DEFAULT_ACCOUNTANT_DOCS_SORT: AccountantDocsSortState = {
  key: "submitted",
  dir: "desc",
};

/** כיוון ראשון בלחיצה על עמודה חדשה */
function accountantDocsDefaultDirForKey(
  key: AccountantDocsSortKey,
): "asc" | "desc" {
  if (key === "submitted" || key === "amount") return "desc";
  return "asc";
}

/** למיין מספרים/חותמות זמן; חסר (null) תמיד בסוף */
function cmpNumericOrTs(
  av: number | null,
  bv: number | null,
  dir: "asc" | "desc",
): number {
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  if (av === bv) return 0;
  if (dir === "asc") return av < bv ? -1 : 1;
  return av > bv ? -1 : 1;
}

function cmpStrings(a: string, b: string, dir: "asc" | "desc"): number {
  const mul = dir === "asc" ? 1 : -1;
  return a.localeCompare(b, "he", { sensitivity: "base" }) * mul;
}

function submittedTs(row: DocRow): number | null {
  const s = row.submittedAt?.trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function amountNumeric(row: DocRow): number | null {
  const s = row.finalAmount?.trim();
  if (!s) return null;
  const n = Number.parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function vendorSortKey(row: DocRow): string {
  return (row.finalVendor ?? "").toLocaleLowerCase("he");
}

function uploadedBySortKey(row: DocRow): string {
  return (row.uploadedByDisplayName ?? "").trim();
}

function sortAccountantDocs(
  list: DocRow[],
  sort: AccountantDocsSortState,
): DocRow[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    let c = 0;
    switch (sort.key) {
      case "client":
        c = cmpStrings(
          a.clientDisplayName.trim(),
          b.clientDisplayName.trim(),
          sort.dir,
        );
        break;
      case "status":
        c = cmpStrings(
          `${a.status}\u0000${a.id}`,
          `${b.status}\u0000${b.id}`,
          sort.dir,
        );
        break;
      case "amount":
        c = cmpNumericOrTs(amountNumeric(a), amountNumeric(b), sort.dir);
        break;
      case "vendor":
        c = cmpStrings(vendorSortKey(a), vendorSortKey(b), sort.dir);
        break;
      case "submitted":
        c = cmpNumericOrTs(submittedTs(a), submittedTs(b), sort.dir);
        break;
      case "uploadedBy":
        c = cmpStrings(uploadedBySortKey(a), uploadedBySortKey(b), sort.dir);
        break;
      default:
        return 0;
    }
    if (c !== 0) return c;
    return cmpStrings(a.id, b.id, "asc");
  });
  return sorted;
}

function SortCue({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) {
    return (
      <span className="ms-1 text-zinc-300" aria-hidden>
        ↕
      </span>
    );
  }
  return (
    <span className="ms-1 text-zinc-600" aria-hidden>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

function AccountantDocumentsMobileSortBar({
  sort,
  onSortChange,
}: {
  sort: AccountantDocsSortState;
  onSortChange: Dispatch<SetStateAction<AccountantDocsSortState>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 md:hidden">
      <span className="text-xs text-zinc-500">מיון</span>
      <label htmlFor="acct-docs-mobile-sort-key" className="sr-only">
        מיון לפי שדה
      </label>
      <select
        id="acct-docs-mobile-sort-key"
        className="max-w-[12rem] rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm"
        value={sort.key}
        onChange={(e) => {
          const key = e.target.value as AccountantDocsSortKey;
          onSortChange({ key, dir: accountantDocsDefaultDirForKey(key) });
        }}
      >
        <option value="client">לקוח</option>
        <option value="status">סטטוס</option>
        <option value="amount">סכום</option>
        <option value="vendor">ספק</option>
        <option value="submitted">נשלח</option>
        <option value="uploadedBy">הועלה ע״י</option>
      </select>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100"
        onClick={() =>
          onSortChange((prev) => ({
            ...prev,
            dir: prev.dir === "asc" ? "desc" : "asc",
          }))
        }
        aria-label={
          sort.dir === "asc"
            ? "מיון עולה — לחץ להפוך ליורד"
            : "מיון יורד — לחץ להפוך לעולה"
        }
      >
        <span aria-hidden className="tabular-nums">
          {sort.dir === "asc" ? "↑" : "↓"}
        </span>
        {sort.dir === "asc" ? "עולה" : "יורד"}
      </button>
    </div>
  );
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
  const [sort, setSort] = useState<AccountantDocsSortState>(
    DEFAULT_ACCOUNTANT_DOCS_SORT,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<{
    id: string;
    mimeType: string;
  } | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const filterPanelId = useId();
  const filterModalTitleId = useId();
  const filterModalDescriptionId = useId();

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

  const handleApproveDoc = useCallback(
    async (documentId: string) => {
      setApprovingId(documentId);
      setListError(null);
      try {
        const res = await fetch(
          `/api/accountants/me/documents/${documentId}/approve`,
          {
            method: "POST",
            credentials: "same-origin",
          },
        );
        let data: { error?: { message?: string } } | null = null;
        try {
          data = (await res.json()) as { error?: { message?: string } };
        } catch {
          data = null;
        }
        if (!res.ok) {
          const msg =
            data?.error?.message?.trim() ??
            `אישור המסמך נכשל (קוד ${res.status}).`;
          setListError(msg);
          return;
        }
        await loadDocs();
      } catch {
        setListError("שגיאת רשת בעת אישור המסמך.");
      } finally {
        setApprovingId(null);
      }
    },
    [loadDocs],
  );

  const toggleSort = useCallback((key: AccountantDocsSortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: accountantDocsDefaultDirForKey(key) };
    });
  }, []);

  const sortedItems = useMemo(
    () => sortAccountantDocs(items, sort),
    [items, sort],
  );

  const sortButtonClass =
    "inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";

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

  useEffect(() => {
    if (!filterPanelOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFilterPanelOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [filterPanelOpen]);

  const closeFilterModal = useCallback(() => setFilterPanelOpen(false), []);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900">מסמכים</h2>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
          aria-expanded={filterPanelOpen}
          aria-haspopup="dialog"
          aria-controls={filterPanelOpen ? filterPanelId : undefined}
          onClick={() => setFilterPanelOpen((open) => !open)}
        >
          סינון
        </button>
      </div>

      {filterPanelOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[115] flex items-start justify-center overflow-y-auto bg-teal-950/45 px-4 py-6 backdrop-blur-[2px] sm:items-center sm:px-3 sm:py-10"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeFilterModal();
              }}
            >
              <div
                id={filterPanelId}
                className="relative z-10 my-auto flex max-h-[calc(100dvh-6rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border border-teal-100/95 bg-white/95 shadow-[0_24px_60px_-28px_rgb(13_148_136_/_0.32)] backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby={filterModalTitleId}
                aria-describedby={filterModalDescriptionId}
                dir="rtl"
              >
                <div className={`${appModalHeaderClass} min-h-[3.25rem] pe-12`}>
                  <h3
                    id={filterModalTitleId}
                    className="max-w-[90%] text-base font-semibold text-zinc-900"
                  >
                    סינון מסמכים
                  </h3>
                  <button
                    type="button"
                    className={appModalCloseButtonClass}
                    aria-label="סגירת חלון הסינון"
                    onClick={closeFilterModal}
                  >
                    <span aria-hidden className="text-lg leading-none">
                      ×
                    </span>
                  </button>
                </div>
                <p
                  id={filterModalDescriptionId}
                  className="shrink-0 border-b border-teal-100/90 bg-white/80 px-4 py-3 text-sm leading-relaxed text-zinc-600 sm:px-5"
                >
                  מסננים לפי לקוח, סטטוס,{" "}
                  <span className="font-medium text-zinc-800">תאריך הגשה</span>
                  {" "}ו/או{" "}
                  <span className="font-medium text-zinc-800">תאריך חשבונית</span>{" "}
                  (ערך סופי או מתוצאות חילוץ),                   ו־
                  <span className="font-medium text-zinc-800">סכום סופי</span> בש״ח
                  במסמך (מספר בלבד).
                  ברירת המחדל: «נשלח לרואה החשבון». ניתן למיין את
                  הרשימה לפי עמודות (חיצים בכותרות; במובייל — בוחר וכיוון).
                </p>
                <div className="max-h-[min(32rem,calc(100dvh-10rem))] space-y-3 overflow-y-auto bg-zinc-50/85 px-4 py-4 sm:px-5">
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
                        onChange={(e) =>
                          setStatusFilter(e.target.value)
                        }
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="submitted">
                          נשלח לרואה החשבון (ברירת מחדל)
                        </option>
                        <option value="approved">
                          אושר על ידי רואה החשבון
                        </option>
                        <option value="">
                          כל הסטטוסים (למעט טעינת קובץ)
                        </option>
                        <option value="all">הכל כולל טיוטות</option>
                        <option value="uploaded">הועלה</option>
                        <option value="ready_to_submit">
                          מוכן לשליחה לרו״ח
                        </option>
                        <option value="needs_review">דורש בדיקה</option>
                        <option value="ocr_processing">עיבוד OCR</option>
                        <option value="ocr_failed">כשל OCR</option>
                        <option value="archived">בארכיון</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200 pt-3">
                    <p className="mb-2 text-xs font-medium text-zinc-600">
                      תאריך הגשה לרואה החשבון
                    </p>
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
                          onChange={(e) =>
                            setSubmittedFrom(e.target.value)
                          }
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
                          onChange={(e) =>
                            setSubmittedTo(e.target.value)
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200 pt-3">
                    <p className="mb-2 text-xs font-medium text-zinc-600">
                      תאריך חשבונית
                    </p>
                    <p className="mb-2 text-xs text-zinc-500">
                      לפי תאריך סופי במסמך; אם אין — לפי תאריך שחולץ
                      אוטומטית. מסמכים בלי תאריך חשבונית לא ייכללו בטווח.
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
                          onChange={(e) =>
                            setInvoiceFrom(e.target.value)
                          }
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
                          onChange={(e) =>
                            setInvoiceTo(e.target.value)
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200 pt-3">
                    <p className="mb-2 text-xs font-medium text-zinc-600">
                      טווח סכומים (סכום סופי במסמך)
                    </p>
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
                          onChange={(e) =>
                            setMinAmount(e.target.value)
                          }
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
                          onChange={(e) =>
                            setMaxAmount(e.target.value)
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t border-teal-100/90 bg-white/95 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    className={`${appModalGhostButtonClass} text-sm`}
                    onClick={closeFilterModal}
                  >
                    סגירה
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

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
          <div className="mt-4 md:hidden">
            <AccountantDocumentsMobileSortBar
              sort={sort}
              onSortChange={setSort}
            />
          </div>
          <ul className="mt-4 flex flex-col gap-3 md:hidden">
            {sortedItems.map((d) => (
              <li key={d.id}>
                <div
                  className={[
                    "rounded-xl px-3 py-4 shadow-sm shadow-zinc-900/5 transition-colors ring-1 ring-zinc-200/60",
                    documentStatusRowSurfaceClass(d.status),
                  ].join(" ")}
                >
                  <div className="font-medium text-zinc-900">
                    {d.clientDisplayName}
                  </div>
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
                      <span className="text-sm text-zinc-400">
                        אין קובץ מוכן
                      </span>
                    )}
                    {canAccountantApproveDocument(d.status) ? (
                      <button
                        type="button"
                        disabled={
                          approvingId === d.id || deletingId === d.id
                        }
                        className="inline-flex text-sm font-semibold text-emerald-900 underline-offset-4 transition hover:text-emerald-950 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          void handleApproveDoc(d.id);
                        }}
                      >
                        {approvingId === d.id ? "מאשרים…" : "אישור המסמך"}
                      </button>
                    ) : null}
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
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table
              className="w-full min-w-[44rem] text-right text-sm"
              dir="rtl"
            >
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th
                    scope="col"
                    className="pb-2 pe-3 font-normal"
                    aria-sort={
                      sort.key === "client"
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className={sortButtonClass}
                      onClick={() => toggleSort("client")}
                    >
                      לקוח
                      <SortCue
                        active={sort.key === "client"}
                        dir={sort.dir}
                      />
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="pb-2 pe-3 font-normal"
                    aria-sort={
                      sort.key === "status"
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className={sortButtonClass}
                      onClick={() => toggleSort("status")}
                    >
                      סטטוס
                      <SortCue
                        active={sort.key === "status"}
                        dir={sort.dir}
                      />
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="pb-2 pe-3 font-normal"
                    aria-sort={
                      sort.key === "amount"
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className={sortButtonClass}
                      onClick={() => toggleSort("amount")}
                    >
                      סכום
                      <SortCue
                        active={sort.key === "amount"}
                        dir={sort.dir}
                      />
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="pb-2 pe-3 font-normal"
                    aria-sort={
                      sort.key === "vendor"
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className={sortButtonClass}
                      onClick={() => toggleSort("vendor")}
                    >
                      ספק
                      <SortCue
                        active={sort.key === "vendor"}
                        dir={sort.dir}
                      />
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="pb-2 pe-3 font-normal"
                    aria-sort={
                      sort.key === "submitted"
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className={sortButtonClass}
                      onClick={() => toggleSort("submitted")}
                    >
                      נשלח
                      <SortCue
                        active={sort.key === "submitted"}
                        dir={sort.dir}
                      />
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="pb-2 pe-3 font-normal"
                    aria-sort={
                      sort.key === "uploadedBy"
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className={sortButtonClass}
                      onClick={() => toggleSort("uploadedBy")}
                    >
                      הועלה ע״י
                      <SortCue
                        active={sort.key === "uploadedBy"}
                        dir={sort.dir}
                      />
                    </button>
                  </th>
                  <th scope="col" className="pb-2 font-normal">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sortedItems.map((d) => (
                  <tr
                    key={d.id}
                    className={[
                      documentStatusRowSurfaceClass(d.status),
                      "text-zinc-800 transition-colors",
                    ].join(" ")}
                  >
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
                        {canAccountantApproveDocument(d.status) ? (
                          <button
                            type="button"
                            disabled={
                              approvingId === d.id || deletingId === d.id
                            }
                            className="font-medium text-emerald-900 underline-offset-4 transition hover:text-emerald-950 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                              void handleApproveDoc(d.id);
                            }}
                          >
                            {approvingId === d.id ? "מאשרים…" : "אישור המסמך"}
                          </button>
                        ) : null}
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
