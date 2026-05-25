"use client";

import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
  useCallback,
  useMemo,
} from "react";
import { isoDateToDisplay } from "@/lib/client/date-input-helpers";
import { SHEKEL_DISPLAY } from "@/lib/client/currency-canonical";
import type { ClientDocumentListItem } from "@/lib/client/queries";
import { formatFinalInvoiceAmountDisplay } from "@/lib/invoice-final-amount";
import { documentStatusLabelHebrew } from "@/lib/document-status-display";
import { documentStatusRowSurfaceClass } from "@/lib/ui/document-status-row-classes";
import { DraftUploadResumeButton } from "./draft-upload-resume-button";

function statusLabel(status: string): string {
  return documentStatusLabelHebrew(status);
}

function listVendor(d: ClientDocumentListItem): string | null {
  const v = d.finalVendor?.trim() || d.extractedVendor?.trim();
  return v && v.length > 0 ? v : null;
}

function listVendorSortKey(d: ClientDocumentListItem): string {
  return (listVendor(d) ?? "").toLocaleLowerCase("he");
}

function invoiceIsoRaw(d: ClientDocumentListItem): string | null {
  const iso = d.finalDate?.trim() || d.extractedDate?.trim();
  return iso ?? null;
}

function invoiceDateDisplay(d: ClientDocumentListItem): string | null {
  const iso = invoiceIsoRaw(d);
  if (!iso) return null;
  const disp = isoDateToDisplay(iso);
  return disp || iso;
}

function parseInvoiceTs(iso: string | null): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const t = Date.UTC(y, mo - 1, da);
  return Number.isNaN(t) ? null : t;
}

function amountNumeric(d: ClientDocumentListItem): number | null {
  const s = d.finalAmount?.trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatAmount(d: ClientDocumentListItem): string {
  const core = formatFinalInvoiceAmountDisplay(d.finalAmount);
  if (core === "—") return "—";
  return `${core} ${SHEKEL_DISPLAY}`;
}

export type DocumentsListSortKey = "vendor" | "amount" | "date" | "status";

export type DocumentsListSortState = {
  key: DocumentsListSortKey;
  dir: "asc" | "desc";
};

export const DEFAULT_DOCUMENTS_LIST_SORT: DocumentsListSortState = {
  key: "status",
  dir: "asc",
};

/** למיין מספרים/חותמות זמן; ערך חסר (null) תמיד בסוף הרשימה */
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

function sortDocuments(
  items: ClientDocumentListItem[],
  sort: DocumentsListSortState,
): ClientDocumentListItem[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    switch (sort.key) {
      case "vendor": {
        const c = cmpStrings(
          listVendorSortKey(a),
          listVendorSortKey(b),
          sort.dir,
        );
        if (c !== 0) return c;
        return cmpStrings(a.id, b.id, "asc");
      }
      case "status": {
        return cmpStrings(
          `${a.status}\u0000${a.id}`,
          `${b.status}\u0000${b.id}`,
          sort.dir,
        );
      }
      case "amount": {
        const c = cmpNumericOrTs(
          amountNumeric(a),
          amountNumeric(b),
          sort.dir,
        );
        if (c !== 0) return c;
        return cmpStrings(a.id, b.id, "asc");
      }
      case "date": {
        const ta = parseInvoiceTs(invoiceIsoRaw(a));
        const tb = parseInvoiceTs(invoiceIsoRaw(b));
        const c = cmpNumericOrTs(ta, tb, sort.dir);
        if (c !== 0) return c;
        return cmpStrings(a.id, b.id, "asc");
      }
      default:
        return 0;
    }
  });
  return sorted;
}

type Props = {
  documents: ClientDocumentListItem[];
  sort: DocumentsListSortState;
  onSortChange: Dispatch<SetStateAction<DocumentsListSortState>>;
};

/** כיוון ברירת־מחדל בהחלפת עמודה */
export function documentsListDefaultDirForKey(
  key: DocumentsListSortKey,
): "asc" | "desc" {
  if (key === "amount" || key === "date") return "desc";
  return "asc";
}

/** בקרת מיון למובייל — מיועד לשורת כותרת (מוסתר מ־md ומעלה) */
export function ClientDocumentsListMobileSortBar({
  sort,
  onSortChange,
}: {
  sort: DocumentsListSortState;
  onSortChange: Dispatch<SetStateAction<DocumentsListSortState>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 md:hidden">
      <span className="text-xs text-zinc-500">מיון</span>
      <label htmlFor="mobile-doc-sort-key" className="sr-only">
        מיון לפי שדה
      </label>
      <select
        id="mobile-doc-sort-key"
        className="max-w-[11rem] rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm"
        value={sort.key}
        onChange={(e) => {
          const key = e.target.value as DocumentsListSortKey;
          onSortChange({ key, dir: documentsListDefaultDirForKey(key) });
        }}
      >
        <option value="date">תאריך חשבונית</option>
        <option value="vendor">ספק</option>
        <option value="amount">סכום</option>
        <option value="status">סטטוס</option>
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

function SortCue({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) {
    return <span className="ms-1 text-zinc-300" aria-hidden>↕</span>;
  }
  return (
    <span className="ms-1 text-zinc-600" aria-hidden>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

export function ClientDocumentsList({
  documents,
  sort,
  onSortChange,
}: Props) {
  const router = useRouter();

  const rows = useMemo(
    () => sortDocuments(documents, sort),
    [documents, sort],
  );

  const toggleSort = useCallback((key: DocumentsListSortKey) => {
    onSortChange((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: documentsListDefaultDirForKey(key) };
    });
  }, [onSortChange]);

  const handleRowActivate = useCallback(
    (id: string) => {
      router.push(`/client/documents/${id}`);
    },
    [router],
  );

  const onRowKeyDown = useCallback(
    (e: KeyboardEvent, id: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleRowActivate(id);
      }
    },
    [handleRowActivate],
  );

  const sortButtonClass =
    "inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";

  const rowInteractiveClass =
    "cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2";

  return (
    <>
      {/* מובייל */}
      <div className="mt-4 md:hidden">
        <ul className="flex flex-col gap-3" role="list">
        {rows.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              tabIndex={0}
              aria-label={`פתיחת פרטים: ${listVendor(d) ?? "ספק לא צוין"}`}
              className={[
                "w-full rounded-lg px-3 py-2 text-right transition-colors",
                documentStatusRowSurfaceClass(d.status),
                rowInteractiveClass,
              ].join(" ")}
              onClick={() => handleRowActivate(d.id)}
              onKeyDown={(e) => onRowKeyDown(e, d.id)}
            >
              <div className="flex flex-col gap-2 text-sm text-zinc-800">
                <div className="font-medium leading-snug">
                  <span className="text-zinc-500">ספק:</span>{" "}
                  <span
                    className={
                      listVendor(d) ? "text-zinc-900" : "font-normal text-zinc-400"
                    }
                  >
                    {listVendor(d) ?? "לא צוין"}
                  </span>
                </div>
                <div className="leading-snug">
                  <span className="text-zinc-500">תאריך חשבונית:</span>{" "}
                  {invoiceDateDisplay(d) ?? "—"}
                </div>
                <div className="leading-snug">
                  <span className="text-zinc-500">סכום:</span>{" "}
                  {formatAmount(d)}
                </div>
                <div className="leading-snug">
                  <span className="text-zinc-500">סטטוס:</span>{" "}
                  {statusLabel(d.status)}
                </div>
              </div>
            </button>
            {d.status === "draft_uploading" ? (
              <div className="mt-2 px-3">
                <DraftUploadResumeButton documentId={d.id} />
              </div>
            ) : null}
          </li>
        ))}
        </ul>
      </div>

      {/* דסקטופ */}
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[26rem] text-right text-sm" dir="rtl">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500">
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
                  <SortCue active={sort.key === "vendor"} dir={sort.dir} />
                </button>
              </th>
              <th
                scope="col"
                className="pb-2 pe-3 font-normal"
                aria-sort={
                  sort.key === "date"
                    ? sort.dir === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                <button
                  type="button"
                  className={sortButtonClass}
                  onClick={() => toggleSort("date")}
                >
                  תאריך חשבונית
                  <SortCue active={sort.key === "date"} dir={sort.dir} />
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
                  <SortCue active={sort.key === "amount"} dir={sort.dir} />
                </button>
              </th>
              <th
                scope="col"
                className="pb-2 font-normal"
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
                  <SortCue active={sort.key === "status"} dir={sort.dir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((d) => (
              <tr
                key={d.id}
                tabIndex={0}
                aria-label={`פתיחת פרטים: ${listVendor(d) ?? "ספק לא צוין"}`}
                className={[
                  documentStatusRowSurfaceClass(d.status),
                  rowInteractiveClass,
                  "text-zinc-800 [&>td:first-child]:pe-3 [&>td:nth-child(n+2)]:pe-3",
                ].join(" ")}
                onClick={() => handleRowActivate(d.id)}
                onKeyDown={(e) => onRowKeyDown(e, d.id)}
              >
                <td className="max-w-[12rem] py-3 align-middle">
                  <span
                    className={
                      listVendor(d)
                        ? "block max-w-[14rem] truncate font-medium text-zinc-900"
                        : "font-normal text-zinc-400"
                    }
                    title={listVendor(d) ?? undefined}
                  >
                    {listVendor(d) ?? "לא צוין"}
                  </span>
                  {d.status === "draft_uploading" ? (
                    <span className="block pt-2">
                      <DraftUploadResumeButton documentId={d.id} />
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap py-3 align-middle tabular-nums text-zinc-700">
                  {invoiceDateDisplay(d) ?? "—"}
                </td>
                <td className="whitespace-nowrap py-3 align-middle text-zinc-700">
                  {formatAmount(d)}
                </td>
                <td className="py-3 align-middle text-zinc-600">
                  {statusLabel(d.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
