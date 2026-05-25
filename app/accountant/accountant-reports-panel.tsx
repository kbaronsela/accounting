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
import { isoDateToDisplay } from "@/lib/client/date-input-helpers";
import { formatFinalInvoiceAmountDisplay } from "@/lib/invoice-final-amount";
import {
  appModalCloseButtonClass,
  appModalGhostButtonClass,
  appModalHeaderClass,
} from "@/lib/ui/modal-classes";

type ClientOption = {
  id: string;
  displayName: string;
};

type ReportRow = {
  id: string;
  clientDisplayName: string;
  finalAmount: string | null;
  finalDate: string | null;
  extractedDate?: string | null;
  finalVendor: string | null;
  finalInvoiceNumber?: string | null;
  extractedInvoiceNumber?: string | null;
};

type ReportSortKey =
  | "vendor"
  | "amount"
  | "invoiceDate"
  | "invoiceNumber";

type ReportSortState = { key: ReportSortKey; dir: "asc" | "desc" };

const REPORT_LIMIT = "2000";

function defaultReportSortDir(key: ReportSortKey): "asc" | "desc" {
  if (key === "amount" || key === "invoiceDate") return "desc";
  return "asc";
}

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

function effectiveInvoiceIso(row: ReportRow): string | null {
  const f = row.finalDate?.trim();
  if (f) return f;
  const e = row.extractedDate?.trim();
  return e && e.length > 0 ? e : null;
}

function invoiceDateDisplay(row: ReportRow): string {
  const iso = effectiveInvoiceIso(row);
  if (!iso) return "—";
  return isoDateToDisplay(iso) || iso;
}

function invoiceDateTs(row: ReportRow): number | null {
  const iso = effectiveInvoiceIso(row);
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : t;
}

function invoiceNumberRaw(row: ReportRow): string {
  const fi = row.finalInvoiceNumber?.trim();
  if (fi) return fi;
  const ex = row.extractedInvoiceNumber?.trim();
  return ex && ex.length > 0 ? ex : "";
}

function invoiceNumberDisplay(row: ReportRow): string {
  return invoiceNumberRaw(row) || "—";
}

function invoiceNumberSortKey(row: ReportRow): string {
  return invoiceNumberRaw(row).toLocaleLowerCase("he");
}

function amountNumeric(row: ReportRow): number | null {
  const s = row.finalAmount?.trim();
  if (!s) return null;
  const n = Number.parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function vendorSortKey(row: ReportRow): string {
  return (row.finalVendor ?? "").trim().toLocaleLowerCase("he");
}

function formatAmount(row: ReportRow): string {
  return formatFinalInvoiceAmountDisplay(row.finalAmount);
}

function reportCsvAmountCell(r: ReportRow): string {
  const s = formatFinalInvoiceAmountDisplay(r.finalAmount);
  return s === "—" ? "" : s;
}

function sortReportRows(rows: ReportRow[], sort: ReportSortState): ReportRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    let c = 0;
    switch (sort.key) {
      case "vendor":
        c = cmpStrings(vendorSortKey(a), vendorSortKey(b), sort.dir);
        break;
      case "amount":
        c = cmpNumericOrTs(amountNumeric(a), amountNumeric(b), sort.dir);
        break;
      case "invoiceDate":
        c = cmpNumericOrTs(
          invoiceDateTs(a),
          invoiceDateTs(b),
          sort.dir,
        );
        break;
      case "invoiceNumber":
        c = cmpStrings(
          `${invoiceNumberSortKey(a)}\u0000${a.id}`,
          `${invoiceNumberSortKey(b)}\u0000${b.id}`,
          sort.dir,
        );
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
      <span className="ms-1 text-zinc-300 print:hidden" aria-hidden>
        ↕
      </span>
    );
  }
  return (
    <span className="ms-1 text-zinc-600 print:hidden" aria-hidden>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

function MobileReportSortBar({
  sort,
  onSortChange,
}: {
  sort: ReportSortState;
  onSortChange: Dispatch<SetStateAction<ReportSortState>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden md:hidden">
      <span className="text-xs text-zinc-500">מיון</span>
      <select
        className="max-w-[12rem] rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm"
        value={sort.key}
        aria-label="מיון דוח לפי"
        onChange={(e) => {
          const key = e.target.value as ReportSortKey;
          onSortChange({
            key,
            dir: defaultReportSortDir(key),
          });
        }}
      >
        <option value="vendor">ספק</option>
        <option value="amount">סכום</option>
        <option value="invoiceDate">תאריך</option>
        <option value="invoiceNumber">מספר חשבונית</option>
      </select>
      <button
        type="button"
        className="inline-flex shrink-0 items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 shadow-sm"
        onClick={() =>
          onSortChange((prev) => ({
            ...prev,
            dir: prev.dir === "asc" ? "desc" : "asc",
          }))
        }
        aria-label={
          sort.dir === "asc"
            ? "מיון עולה — להפוך ליורד"
            : "מיון יורד — להפוך לעולה"
        }
      >
        {sort.dir === "asc" ? "↑ עולה" : "↓ יורד"}
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

function csvEscapeCell(value: string): string {
  if (/[,"\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function buildReportCsv(sorted: ReportRow[]): string {
  const header = ["ספק", "סכום", "תאריך חשבונית", "מספר חשבונית"];
  const rows = sorted.map((r) => [
    (r.finalVendor ?? "").trim() || "",
    reportCsvAmountCell(r),
    effectiveInvoiceIso(r) ?? "",
    invoiceNumberRaw(r),
  ]);
  const lines = [
    header.map(csvEscapeCell).join(","),
    ...rows.map((cells) =>
      cells.map((c) => csvEscapeCell(c)).join(","),
    ),
  ];
  return lines.join("\r\n");
}

/** מקטע בטוח לשם קובץ הורדה (שם לקוח וכו׳). */
function sanitizeReportDownloadNamePart(raw: string): string {
  const t = raw
    .replace(/[/\\:*?"<>|\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return t.length > 0 ? t : "client";
}

export function AccountantReportsPanel() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientIdFilter, setClientIdFilter] = useState("");
  /** ברירת מחדל: כל הסטטוסים (למעט טיוטות) — כמו API כשמשאירים ריק */
  const [statusFilter, setStatusFilter] = useState("");
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");
  const [invoiceFrom, setInvoiceFrom] = useState("");
  const [invoiceTo, setInvoiceTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [items, setItems] = useState<ReportRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sort, setSort] = useState<ReportSortState>({
    key: "invoiceDate",
    dir: "desc",
  });
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

  useEffect(() => {
    if (clients.length === 1) {
      setClientIdFilter((prev) =>
        prev === clients[0].id ? prev : clients[0].id,
      );
    }
  }, [clients]);

  const loadDocs = useCallback(async () => {
    setListError(null);

    const cid = clientIdFilter.trim();
    if (!cid) {
      setItems([]);
      setLastLoadedAt(null);
      setListError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fromD = submittedFrom.trim();
    const toD = submittedTo.trim();
    if (fromD && toD && fromD > toD) {
      setItems([]);
      setListError(
        "תאריך עדכון במערכת — «מתאריך» חייב להיות לפני או שווה ל־«עד תאריך».",
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
        setListError("סכום מינימום חייב להיות קטן או שווה למקסימום.");
        setLoading(false);
        return;
      }
    }

    const params: Record<string, string> = {
      limit: REPORT_LIMIT,
      clientId: cid,
    };
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
        items?: ReportRow[];
        error?: { message?: string };
      };
      if (!res.ok) {
        setItems([]);
        setListError(data.error?.message ?? "לא ניתן לטעון נתונים לדוח.");
        setLoading(false);
        return;
      }
      setItems(data.items ?? []);
      setLastLoadedAt(new Date());
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

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const sortedItems = useMemo(
    () => sortReportRows(items, sort),
    [items, sort],
  );

  const toggleSort = useCallback((key: ReportSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultReportSortDir(key) },
    );
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportCsv = useCallback(() => {
    const csvRaw = buildReportCsv(sortedItems);
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvRaw], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const cid = clientIdFilter.trim();
    const display =
      cid ? (clients.find((c) => c.id === cid)?.displayName ?? "").trim() : "";
    const fallback = cid ? `id-${cid.slice(0, 12)}` : "client";
    const clientPart = sanitizeReportDownloadNamePart(display || fallback);
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `documents-report_${clientPart}_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [sortedItems, clientIdFilter, clients]);

  const selectedClientName = useMemo(() => {
    const id = clientIdFilter.trim();
    if (!id) return "";
    return clients.find((c) => c.id === id)?.displayName ?? "";
  }, [clients, clientIdFilter]);

  const printGeneratedFooter = useMemo(() => {
    if (!lastLoadedAt) return "";
    return `נוצר ${lastLoadedAt.toLocaleString("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
  }, [lastLoadedAt]);

  const canRunReport = Boolean(clientIdFilter.trim());

  const sortButtonClass =
    "inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";

  const closeFilterModal = useCallback(() => setFilterPanelOpen(false), []);

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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm ring-1 ring-teal-100/80 print:border-black print:bg-white print:shadow-none">
        <div className="acct-report-print-root space-y-4 p-4 sm:p-6 print:p-0">
          <style>
            {`@media print {
  @page { size: A4 portrait; margin: 11mm 10mm 14mm; }
  .acct-report-print-root { box-sizing: border-box; max-width: 100%; }
  .acct-report-print-title {
    font-weight: 700;
    padding: 6px 10px;
    margin: 0 0 10px;
    border-radius: 2px;
    background-color: #e4e9ec;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .acct-report-print-root table.acct-report-table {
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .acct-report-print-root .acct-report-table thead th {
    font-weight: 700;
    background-color: #dce3e9 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .acct-report-print-root .acct-report-table th,
  .acct-report-print-root .acct-report-table td {
    border: 1px solid #bdbdbd;
    padding: 3px 5px;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .acct-report-print-root .acct-report-table tbody .acct-report-data-row:nth-child(odd) {
    background-color: #ffffff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .acct-report-print-root .acct-report-table tbody .acct-report-data-row:nth-child(even) {
    background-color: #efeff1 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .acct-report-col-vendor { width: 41%; max-width: 41%; }
  .acct-report-col-amount { width: 13%; max-width: 13%; white-space: nowrap; }
  .acct-report-col-date { width: 17%; max-width: 17%; white-space: nowrap; }
  .acct-report-col-inv { width: 29%; max-width: 29%; }
}`}
          </style>
          <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="text-base font-semibold text-zinc-900">דוחות</h2>
              <div className="flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2">
                <label
                  htmlFor="acct-rpt-client-main"
                  className="text-sm font-medium text-zinc-700"
                >
                  דוח עבור
                </label>
                <select
                  id="acct-rpt-client-main"
                  value={clientIdFilter}
                  onChange={(e) => setClientIdFilter(e.target.value)}
                  className="min-w-[12rem] max-w-full flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm sm:max-w-xs"
                >
                  <option value="">
                    {clients.length === 0 ? "טוען לקוחות…" : "בחרו לקוח…"}
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              aria-expanded={filterPanelOpen}
              aria-haspopup="dialog"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              onClick={() => setFilterPanelOpen((open) => !open)}
            >
              סינון
            </button>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              disabled={sortedItems.length === 0 || loading || !canRunReport}
              className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              הדפסה
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={sortedItems.length === 0 || loading || !canRunReport}
              className="inline-flex items-center rounded-lg border border-teal-800 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-950 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              יצוא לאקסל ‎(.csv‎)
            </button>
          </div>

          {filterPanelOpen
            ? createPortal(
                <div
                  className="fixed inset-0 z-[115] flex items-start justify-center overflow-y-auto bg-teal-950/45 px-4 py-6 backdrop-blur-[2px] sm:items-center sm:px-3 sm:py-10 print:hidden"
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
                        סינון דוח
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
                      className="shrink-0 border-b border-teal-100/90 bg-white/80 px-4 py-3 text-sm text-zinc-600 sm:px-5"
                    >
                      סינון לפי סטטוס, תאריכי עדכון במערכת, תאריך חשבונית וטווח סכומים —
                      בהתאמה לכללים בסקשן המסמכים (עד ל־{REPORT_LIMIT} מסמכים).
                      הלקוח נבחר רק בשדה «דוח עבור» בראש העמוד.
                    </p>
                    <div className="max-h-[min(32rem,calc(100dvh-10rem))] space-y-3 overflow-y-auto bg-zinc-50/85 px-4 py-4 sm:px-5">
                      <div className="min-w-[11rem] max-w-xl">
                          <label
                            htmlFor="acct-rpt-status"
                            className="mb-1 block text-xs font-medium text-zinc-700"
                          >
                            סטטוס
                          </label>
                          <select
                            id="acct-rpt-status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="">
                              למעט טיוטות (ברירת מחדל)
                            </option>
                            <option value="uploaded">הועלה (לפני אישור רו״ח)</option>
                            <option value="submitted">סטטוס ישן: submitted</option>
                            <option value="approved">
                              אושר על ידי רואה החשבון
                            </option>
                            <option value="all">הכל כולל טיוטות</option>
                            <option value="ready_to_submit">סטטוס ישן: ready_to_submit</option>
                            <option value="needs_review">סטטוס ישן: needs_review</option>
                            <option value="ocr_processing">בעיבוד (OCR)</option>
                            <option value="ocr_failed">סטטוס ישן: ocr_failed</option>
                            <option value="archived">בארכיון</option>
                          </select>
                        </div>
                      <div className="border-t border-zinc-200 pt-3">
                        <p className="mb-2 text-xs font-medium text-zinc-600">
                          עדכון אחרון במערכת
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="acct-rpt-from"
                              className="mb-1 block text-xs font-medium text-zinc-700"
                            >
                              מתאריך עדכון
                            </label>
                            <input
                              id="acct-rpt-from"
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
                              htmlFor="acct-rpt-to"
                              className="mb-1 block text-xs font-medium text-zinc-700"
                            >
                              עד תאריך עדכון
                            </label>
                            <input
                              id="acct-rpt-to"
                              type="date"
                              value={submittedTo}
                              onChange={(e) => setSubmittedTo(e.target.value)}
                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-zinc-200 pt-3">
                        <p className="mb-2 text-xs font-medium text-zinc-600">
                          תאריך חשבונית (סופי או מתוצאות חילוץ)
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="acct-rpt-inv-from"
                              className="mb-1 block text-xs font-medium text-zinc-700"
                            >
                              חשבונית מתאריך
                            </label>
                            <input
                              id="acct-rpt-inv-from"
                              type="date"
                              value={invoiceFrom}
                              onChange={(e) => setInvoiceFrom(e.target.value)}
                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="acct-rpt-inv-to"
                              className="mb-1 block text-xs font-medium text-zinc-700"
                            >
                              חשבונית עד תאריך
                            </label>
                            <input
                              id="acct-rpt-inv-to"
                              type="date"
                              value={invoiceTo}
                              onChange={(e) => setInvoiceTo(e.target.value)}
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
                              htmlFor="acct-rpt-min-amt"
                              className="mb-1 block text-xs font-medium text-zinc-700"
                            >
                              סכום מינימום
                            </label>
                            <input
                              id="acct-rpt-min-amt"
                              type="text"
                              inputMode="decimal"
                              value={minAmount}
                              onChange={(e) => setMinAmount(e.target.value)}
                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="acct-rpt-max-amt"
                              className="mb-1 block text-xs font-medium text-zinc-700"
                            >
                              סכום מקסימום
                            </label>
                            <input
                              id="acct-rpt-max-amt"
                              type="text"
                              inputMode="decimal"
                              value={maxAmount}
                              onChange={(e) => setMaxAmount(e.target.value)}
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

          {selectedClientName ? (
            <div className="hidden print:block print:text-center">
              <p className="acct-report-print-title text-[13pt] leading-snug text-black">
                דוח עבור {selectedClientName}
              </p>
            </div>
          ) : null}

          {!canRunReport ? null : loading ? (
            <p className="text-sm text-zinc-600">טוענים דוח…</p>
          ) : listError ? (
            <p className="text-sm text-red-700" role="alert">
              {listError}
            </p>
          ) : sortedItems.length === 0 ? (
            <p className="text-sm text-zinc-600 print:hidden">
              אין רשומות לפי המסננים.
            </p>
          ) : (
            <>
              <MobileReportSortBar sort={sort} onSortChange={setSort} />

              <div className="-mx-1 overflow-x-auto print:mx-0 print:w-full print:max-w-none print:overflow-visible">
                <table
                  className="acct-report-table min-w-[24rem] w-full max-w-full border-collapse text-sm print:min-w-0 print:text-inherit"
                  dir="rtl"
                >
                  <thead>
                    <tr className="border-b border-teal-200/80 bg-gradient-to-bl from-teal-50 to-emerald-50/80 print:border-black print:bg-transparent">
                      <th
                        scope="col"
                        className="acct-report-col-vendor px-2 py-2.5 text-start font-semibold text-teal-950 print:border print:px-1 print:py-1"
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
                        className="acct-report-col-amount px-2 py-2.5 text-start font-semibold text-teal-950 tabular-nums print:border print:px-1 print:py-1"
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
                        className="acct-report-col-date px-2 py-2.5 text-start font-semibold text-teal-950 tabular-nums print:border print:px-1 print:py-1"
                      >
                        <button
                          type="button"
                          className={sortButtonClass}
                          onClick={() => toggleSort("invoiceDate")}
                        >
                          תאריך
                          <SortCue
                            active={sort.key === "invoiceDate"}
                            dir={sort.dir}
                          />
                        </button>
                      </th>
                      <th
                        scope="col"
                        className="acct-report-col-inv px-2 py-2.5 text-start font-semibold text-teal-950 print:border print:px-1 print:py-1"
                      >
                        <button
                          type="button"
                          className={sortButtonClass}
                          onClick={() => toggleSort("invoiceNumber")}
                        >
                          מספר חשבונית
                          <SortCue
                            active={sort.key === "invoiceNumber"}
                            dir={sort.dir}
                          />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedItems.map((d, idx) => (
                      <tr
                        key={d.id}
                        className={`acct-report-data-row ${idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}`}
                      >
                        <td
                          className="acct-report-col-vendor max-w-[12rem] px-2 py-2 text-zinc-800 print:max-w-none print:border print:px-1 print:py-1"
                          title={(d.finalVendor ?? "").trim()}
                        >
                          {(d.finalVendor ?? "").trim() || (
                            <span className="text-zinc-400">לא צוין</span>
                          )}
                        </td>
                        <td className="acct-report-col-amount whitespace-nowrap px-2 py-2 tabular-nums print:border print:px-1 print:py-1">
                          {formatAmount(d)}
                        </td>
                        <td className="acct-report-col-date whitespace-nowrap px-2 py-2 tabular-nums print:border print:px-1 print:py-1">
                          {invoiceDateDisplay(d)}
                        </td>
                        <td
                          dir="ltr"
                          className="acct-report-col-inv px-2 py-2 text-start text-zinc-800 print:border print:px-1 print:py-1"
                        >
                          <span>{invoiceNumberDisplay(d)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {lastLoadedAt && printGeneratedFooter ? (
                <p className="mt-6 hidden text-center text-[9pt] leading-relaxed text-zinc-600 print:block print:mt-8">
                  {printGeneratedFooter}
                </p>
              ) : null}

              {lastLoadedAt ? (
                <p className="text-xs text-zinc-500 print:hidden">
                  עדכון נתונים אחרון:{" "}
                  {lastLoadedAt.toLocaleString("he-IL", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
