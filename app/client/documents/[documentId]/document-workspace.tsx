"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  isoDateToDisplay,
  parseFlexibleInvoiceDate,
  parseStoredIsoDate,
  todayIsoLocal,
} from "@/lib/client/date-input-helpers";

export type ClientDocumentDetailInitial = {
  id: string;
  clientId: string;
  clientDisplayName: string | null;
  status: string;
  finalAmount: string | null;
  finalCurrency: string | null;
  finalDate: string | null;
  finalVendor: string | null;
  clientNote: string | null;
  submittedAt: string | null;
  editable: boolean;
};

const CURRENCY_OPTIONS = [
  { code: "ILS" as const, label: "\u05E9\u05F4\u05D7" },
  { code: "USD" as const, label: "\u05D3\u05D5\u05DC\u05E8" },
  { code: "EUR" as const, label: "\u05D9\u05D5\u05E8\u05D5" },
];

function coerceSelectableCurrency(raw: string | null | undefined): "ILS" | "USD" | "EUR" {
  const u = (raw ?? "").trim().toUpperCase();
  if (u === "USD" || u === "EUR") return u;
  return "ILS";
}

const STATUS_LABELS: Record<string, string> = {
  draft_uploading: "טעינת קובץ",
  uploaded: "הועלה",
  ocr_processing: "עיבוד OCR",
  needs_review: "דורש בדיקה",
  ready_to_submit: "מוכן לשליחה לרו״ח",
  submitted: "נשלח לרואה החשבון",
};

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function ClientDocumentWorkspace({
  initial,
}: {
  initial: ClientDocumentDetailInitial;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status);

  const finalEditable = initial.editable && status !== "submitted";

  const [finalAmount, setFinalAmount] = useState(initial.finalAmount ?? "");
  const [finalCurrencyCode, setFinalCurrencyCode] = useState(
    () => coerceSelectableCurrency(initial.finalCurrency),
  );

  const [invoiceDate, setInvoiceDate] = useState(() => {
    const iso =
      parseStoredIsoDate(initial.finalDate) ?? todayIsoLocal();
    return { iso, display: isoDateToDisplay(iso) };
  });
  const [invoiceDateParseError, setInvoiceDateParseError] = useState<
    string | null
  >(null);

  const [finalVendor, setFinalVendor] = useState(initial.finalVendor ?? "");
  const [clientNote, setClientNote] = useState(initial.clientNote ?? "");

  const [submitErrors, setSubmitErrors] = useState<Record<
    string,
    string[]
  > | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  function flushInvoiceDateFromDisplay(): boolean {
    const parsed = parseFlexibleInvoiceDate(invoiceDate.display);
    if (!parsed.ok) {
      setInvoiceDateParseError(parsed.message);
      return false;
    }
    setInvoiceDateParseError(null);
    setInvoiceDate({ iso: parsed.iso, display: parsed.displayNormalized });
    return true;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitErrors(null);
    if (!flushInvoiceDateFromDisplay()) {
      setError("בדקי את שדה התאריך.");
      return;
    }
    setPendingSave(true);
    try {
      const res = await fetch(`/api/client/documents/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalAmount: finalAmount.trim(),
          finalCurrency: finalCurrencyCode,
          finalDate: invoiceDate.iso,
          finalVendor: finalVendor.trim(),
          clientNote: clientNote.trim() === "" ? null : clientNote.trim(),
        }),
      });
      const data = (await res.json()) as {
        status?: string;
        editable?: boolean;
        error?: {
          message?: string;
          details?: { fields?: Record<string, string[]> };
        };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "שמירה נכשלה.");
        setPendingSave(false);
        return;
      }
      setStatus(data.status ?? status);
      setMessage("השינויים נשמרו.");
      router.refresh();
    } catch {
      setError("שגיאת רשת.");
    }
    setPendingSave(false);
  }

  async function handleSubmit() {
    setMessage(null);
    setError(null);
    setSubmitErrors(null);
    if (!flushInvoiceDateFromDisplay()) {
      setError("בדקי את שדה התאריך לפני ההגשה.");
      return;
    }
    setPendingSubmit(true);
    const patchPayload = {
      finalAmount: finalAmount.trim(),
      finalCurrency: finalCurrencyCode,
      finalDate: invoiceDate.iso,
      finalVendor: finalVendor.trim(),
      clientNote: clientNote.trim() === "" ? null : clientNote.trim(),
    };
    try {
      const patchRes = await fetch(`/api/client/documents/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload),
      });
      const patchData = (await patchRes.json()) as {
        error?: { message?: string };
      };
      if (!patchRes.ok) {
        setError(patchData.error?.message ?? "שמירה לפני הגשה נכשלה.");
        setPendingSubmit(false);
        return;
      }

      const res = await fetch(
        `/api/client/documents/${initial.id}/submit`,
        {
          method: "POST",
        },
      );
      const data = (await res.json()) as {
        error?: {
          message?: string;
          details?: { fields?: Record<string, string[]> };
        };
      };
      if (!res.ok) {
        const fields = data.error?.details?.fields;
        if (res.status === 422 && fields) {
          setSubmitErrors(fields);
          setError(data.error?.message ?? "לא ניתן להגיש.");
        } else {
          setError(data.error?.message ?? "ההגשה נכשלה.");
        }
        setPendingSubmit(false);
        return;
      }
      setStatus("submitted");
      setMessage("המסמך הוגש לרואה החשבון.");
      router.refresh();
    } catch {
      setError("שגיאת רשת.");
    }
    setPendingSubmit(false);
  }

  const showFileLink = status !== "draft_uploading";
  const title =
    initial.clientDisplayName ?? initial.clientId.slice(0, 8);

  return (
    <div
      className="mx-auto max-w-xl space-y-5 px-3 pb-10 pt-6 sm:space-y-6 sm:px-4 sm:pt-10"
      dir="rtl"
    >
      <div>
        <Link
          href="/client"
          className="text-sm text-blue-700 underline-offset-4 hover:underline"
        >
          חזרה לדשבורד
        </Link>
        <h1 className="mt-4 text-lg font-semibold text-zinc-900 sm:text-xl">
          מסמך
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          תיק: <span className="font-medium">{title}</span> · סטטוס:{" "}
          {STATUS_LABELS[status] ?? status}
        </p>
        {status === "submitted" && initial.submittedAt ? (
          <p className="mt-2 text-sm text-zinc-500">
            תאריך הגשה:{" "}
            {new Date(initial.submittedAt).toLocaleString("he-IL", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : null}
      </div>

      {showFileLink ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-800">קבצים</p>
          <a
            href={`/api/client/documents/${initial.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-blue-700 underline-offset-4 hover:underline"
          >
            פתיחת הקובץ בלשונית חדשה
          </a>
        </div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <h2 className="text-base font-semibold text-zinc-900">
          פרטי חשבונית להגשה
        </h2>
        <p className="text-sm text-zinc-600">
          לפני שליחה לרואה החשבון יש למלא את כל השדות החובה (סכום, מטבע, תאריך,
          ספק).
        </p>

        <div>
          <label htmlFor="d-amt" className="mb-1 block text-sm text-zinc-700">
            סכום סופי
          </label>
          <input
            id="d-amt"
            type="text"
            inputMode="decimal"
            value={finalAmount}
            disabled={!finalEditable}
            onChange={(e) => setFinalAmount(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
          {submitErrors?.finalAmount ? (
            <p className="mt-1 text-xs text-red-600">
              {submitErrors.finalAmount.join(" · ")}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="d-curr" className="mb-1 block text-sm text-zinc-700">
            מטבע
          </label>
          <select
            id="d-curr"
            value={finalCurrencyCode}
            disabled={!finalEditable}
            onChange={(e) =>
              setFinalCurrencyCode(e.target.value as "ILS" | "USD" | "EUR")
            }
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {CURRENCY_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label} ({o.code})
              </option>
            ))}
          </select>
          {submitErrors?.finalCurrency ? (
            <p className="mt-1 text-xs text-red-600">
              {submitErrors.finalCurrency.join(" · ")}
            </p>
          ) : null}
        </div>

        <div>
          <span className="mb-1 block text-sm text-zinc-700">
            תאריך חשבונית (DD.MM.YYYY)
          </span>
          <div className="flex flex-nowrap items-stretch gap-1">
            <input
              id="d-date-display"
              type="text"
              placeholder={`למשל ${isoDateToDisplay(todayIsoLocal())}`}
              inputMode="numeric"
              autoComplete="off"
              value={invoiceDate.display}
              disabled={!finalEditable}
              onChange={(e) => {
                setInvoiceDateParseError(null);
                const v = e.target.value;
                const parsed = parseFlexibleInvoiceDate(v);
                setInvoiceDate((p) =>
                  parsed.ok ? { iso: parsed.iso, display: v } : { ...p, display: v },
                );
              }}
              onBlur={() => flushInvoiceDateFromDisplay()}
              className="min-w-0 flex-1 rounded-s-md rounded-e-none border border-zinc-300 border-e-0 px-3 py-2 text-sm disabled:bg-zinc-100"
              aria-invalid={invoiceDateParseError ? true : undefined}
              aria-describedby="d-date-help"
            />
            <span
              className={[
                "relative inline-flex shrink-0 items-stretch rounded-e-md rounded-s-none border border-zinc-300 border-s-0 bg-white -ms-px",
                !finalEditable ? "opacity-40" : "",
              ].join(" ")}
            >
              <input
                id="d-date-picker-native"
                type="date"
                tabIndex={-1}
                value={invoiceDate.iso}
                disabled={!finalEditable}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setInvoiceDateParseError(null);
                  setInvoiceDate({
                    iso: v,
                    display: isoDateToDisplay(v),
                  });
                }}
                aria-label="פתיחת בחירת תאריך"
                title="בחירת תאריך"
                className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
              <span
                className="pointer-events-none inline-flex shrink-0 items-center justify-center px-2.5 py-2 text-zinc-600"
                aria-hidden
              >
                <CalendarIcon />
              </span>
            </span>
          </div>
          <p id="d-date-help" className="mt-1 text-xs text-zinc-500">
            ברירת מחדל: היום. סמל הקלנדר ליד השדה פותח את מתאריכון המערכת. ניתן
            גם להקליד ב-DD.MM.YYYY עם נקודות, עם / או עם - רק כשמתקבלת פרשנות
            תאריך אחת ברורה; אחרת תופיע שגיאה.
          </p>
          {invoiceDateParseError ? (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {invoiceDateParseError}
            </p>
          ) : null}
          {submitErrors?.finalDate ? (
            <p className="mt-1 text-xs text-red-600">
              {submitErrors.finalDate.join(" · ")}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="d-vendor" className="mb-1 block text-sm text-zinc-700">
            ספק / שם העסק
          </label>
          <input
            id="d-vendor"
            type="text"
            value={finalVendor}
            disabled={!finalEditable}
            onChange={(e) => setFinalVendor(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
          {submitErrors?.finalVendor ? (
            <p className="mt-1 text-xs text-red-600">
              {submitErrors.finalVendor.join(" · ")}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="d-note" className="mb-1 block text-sm text-zinc-700">
            הערה (אופציונלי)
          </label>
          <textarea
            id="d-note"
            value={clientNote}
            disabled={!finalEditable}
            onChange={(e) => setClientNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-800" role="status">
            {message}
          </p>
        ) : null}

        {finalEditable ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            <button
              type="submit"
              disabled={pendingSave || pendingSubmit}
              className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
            >
              {pendingSave ? "שומרים…" : "שמירה"}
            </button>
            <button
              type="button"
              disabled={pendingSave || pendingSubmit}
              onClick={() => void handleSubmit()}
              className="w-full rounded-md border border-emerald-800 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-60 sm:w-auto"
            >
              {pendingSubmit ? "שולחים…" : "הגשה לרואה החשבון"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            {status === "submitted"
              ? "המסמך הוגש ולא ניתן לערוך במסגרת MVP."
              : "לא ניתן לערוך מסמך במצב זה."}
          </p>
        )}
      </form>
    </div>
  );
}
