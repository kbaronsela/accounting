"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { DocumentFileViewerOverlay } from "@/components/document-file-viewer-overlay";
import { DraftUploadResumeButton } from "@/app/client/draft-upload-resume-button";
import { SHEKEL_DISPLAY } from "@/lib/client/currency-canonical";
import {
  isoDateToDisplay,
  parseFlexibleInvoiceDate,
  parseStoredIsoDate,
  todayIsoLocal,
} from "@/lib/client/date-input-helpers";
import { finalInvoiceAmountInputValueFromStored } from "@/lib/invoice-final-amount";

export type ClientDocumentDetailInitial = {
  id: string;
  clientId: string;
  clientDisplayName: string | null;
  mimeType: string;
  status: string;
  finalAmount: string | null;
  finalCurrency: string | null;
  finalDate: string | null;
  finalVendor: string | null;
  finalInvoiceNumber: string | null;
  extractedInvoiceNumber: string | null;
  clientNote: string | null;
  submittedAt: string | null;
  editable: boolean;
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

  const finalEditable =
    initial.editable && status !== "submitted" && status !== "approved";

  const [finalAmount, setFinalAmount] = useState(() =>
    finalInvoiceAmountInputValueFromStored(initial.finalAmount),
  );

  const [invoiceDate, setInvoiceDate] = useState(() => {
    const iso = parseStoredIsoDate(initial.finalDate);
    if (!iso) return { iso: "", display: "" };
    return { iso, display: isoDateToDisplay(iso) };
  });
  const [invoiceDateParseError, setInvoiceDateParseError] = useState<
    string | null
  >(null);

  const [finalVendor, setFinalVendor] = useState(initial.finalVendor ?? "");
  const [finalInvoiceNumber, setFinalInvoiceNumber] = useState(
    initial.finalInvoiceNumber ?? "",
  );
  const [clientNote, setClientNote] = useState(initial.clientNote ?? "");

  const [submitErrors, setSubmitErrors] = useState<Record<
    string,
    string[]
  > | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const [fileViewerOpen, setFileViewerOpen] = useState(false);

  const closeFileViewer = useCallback(() => setFileViewerOpen(false), []);

  function flushInvoiceDateFromDisplay(): boolean {
    const d = invoiceDate.display.trim();
    if (!d) {
      setInvoiceDateParseError(null);
      setInvoiceDate({ iso: "", display: "" });
      return true;
    }
    const parsed = parseFlexibleInvoiceDate(invoiceDate.display);
    if (!parsed.ok) {
      setInvoiceDateParseError(parsed.message);
      return false;
    }
    setInvoiceDateParseError(null);
    setInvoiceDate({ iso: parsed.iso, display: parsed.displayNormalized });
    return true;
  }

  function buildPatchBody() {
    const amt = finalAmount.trim();
    return {
      finalAmount: amt === "" ? null : amt,
      finalCurrency: amt ? SHEKEL_DISPLAY : null,
      finalDate: invoiceDate.iso.trim() === "" ? null : invoiceDate.iso,
      finalVendor: finalVendor.trim() === "" ? null : finalVendor.trim(),
      finalInvoiceNumber:
        finalInvoiceNumber.trim() === "" ? null : finalInvoiceNumber.trim(),
      clientNote: clientNote.trim() === "" ? null : clientNote.trim(),
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitErrors(null);
    if (!flushInvoiceDateFromDisplay()) {
      setError("יש לבדוק את שדה התאריך.");
      return;
    }
    setPendingSave(true);
    try {
      const res = await fetch(`/api/client/documents/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatchBody()),
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
      setError("יש לבדוק את שדה התאריך לפני ההגשה.");
      return;
    }
    setPendingSubmit(true);
    const patchPayload = buildPatchBody();
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
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-5 pb-10 sm:space-y-6">
      <div>
        <Link
          href="/client"
          className="text-sm font-medium text-teal-800 underline-offset-4 transition hover:bg-teal-50/70 hover:text-teal-950 hover:underline"
        >
          חזרה לניהול מסמכים
        </Link>
        <h1 className="mt-4 text-lg font-semibold text-zinc-900 sm:text-xl">
          מסמך
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          לקוח: <span className="font-medium">{title}</span> · סטטוס:{" "}
          {STATUS_LABELS[status] ?? status}
        </p>
        {(status === "submitted" || status === "approved") &&
        initial.submittedAt ? (
          <p className="mt-2 text-sm text-zinc-500">
            תאריך הגשה:{" "}
            {new Date(initial.submittedAt).toLocaleString("he-IL", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : null}
      </div>

      {status === "draft_uploading" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-amber-950">
            ההעלאה לא הושלמה אצל השרת
          </p>
          <p className="mt-1 text-xs text-amber-900/90">
            אם קובץ בכלל לא נשמר בשרת, «להשלים» לא יעזור — יש למחוק את הטיוטה
            ולהעלות מחדש מהטופס בדשבורד. אם הקובץ כבר בשרת ורק שלב האישור
            האחרון נקטע, יש להשתמש ב«להשלים».
          </p>
          <div className="mt-3">
            <DraftUploadResumeButton documentId={initial.id} />
          </div>
        </div>
      ) : null}

      {showFileLink ? (
        <div className="rounded-xl border border-teal-100/90 bg-white/95 p-4 shadow-[0_4px_20px_-8px_rgb(13_148_136_/_0.08)]">
          <button
            type="button"
            onClick={() => setFileViewerOpen(true)}
            className="text-sm font-semibold text-teal-800 underline-offset-4 transition hover:text-teal-950 hover:underline"
          >
            הצגת הקובץ
          </button>
          {fileViewerOpen
            ? createPortal(
                <DocumentFileViewerOverlay
                  viewerKey={initial.id}
                  mimeTypeHint={initial.mimeType}
                  onClose={closeFileViewer}
                  fetchFile={() =>
                    fetch(`/api/client/documents/${initial.id}/file`, {
                      credentials: "same-origin",
                      cache: "no-store",
                    })
                  }
                />,
                document.body,
              )
            : null}
        </div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="min-w-0 space-y-4 rounded-xl border border-teal-100/90 bg-white/95 p-4 shadow-[0_4px_24px_-8px_rgb(13_148_136_/_0.06)] sm:p-6"
      >
        <h2 className="text-base font-semibold text-zinc-900">
          פרטי חשבונית לשליחה
        </h2>
        <p className="text-xs text-zinc-500">
          כל השדות למטה אופציונליים — ניתן לשלוח לרואה החשבון גם בלי מילוי,
          עם קובץ המצורף ועם עריכה מאוחרת אצלה או אצל הרו״ח.
        </p>

        <div>
          <label htmlFor="d-amt" className="mb-1 block text-sm text-zinc-700">
            סכום סופי
            <span className="ms-1 font-normal text-zinc-500">(אופציונלי)</span>
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

        <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          כשנרשם סכום הוא נשמר ב־{SHEKEL_DISPLAY}.
        </p>

        <div className="min-w-0">
          <label htmlFor="d-date-display" className="mb-1 block text-sm text-zinc-700">
            תאריך חשבונית (DD.MM.YYYY)
            <span className="ms-1 font-normal text-zinc-500">(אופציונלי)</span>
          </label>
          <div className="flex min-w-0 flex-row flex-nowrap items-stretch gap-0">
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
                if (!v.trim()) {
                  setInvoiceDate({ iso: "", display: "" });
                  return;
                }
                const parsed = parseFlexibleInvoiceDate(v);
                setInvoiceDate((p) =>
                  parsed.ok ? { iso: parsed.iso, display: v } : { ...p, display: v },
                );
              }}
              onBlur={() => flushInvoiceDateFromDisplay()}
              className="min-w-0 flex-1 rounded-s-md rounded-e-none border border-zinc-300 border-e-0 px-3 py-2 text-sm disabled:bg-zinc-100"
              aria-invalid={invoiceDateParseError ? true : undefined}
              aria-describedby={
                invoiceDateParseError ? "d-date-error" : undefined
              }
            />
            <span
              className={[
                "relative inline-flex h-10 w-11 shrink-0 items-stretch rounded-e-md rounded-s-none border border-zinc-300 border-s-0 bg-white -ms-px",
                !finalEditable ? "opacity-40" : "",
              ].join(" ")}
            >
              <input
                id="d-date-picker-native"
                type="date"
                tabIndex={-1}
                value={parseStoredIsoDate(invoiceDate.iso) ?? ""}
                disabled={!finalEditable}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    setInvoiceDateParseError(null);
                    setInvoiceDate({ iso: "", display: "" });
                    return;
                  }
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
                className="pointer-events-none inline-flex shrink-0 flex-1 items-center justify-center px-2.5 py-2 text-zinc-600 sm:flex-initial"
                aria-hidden
              >
                <CalendarIcon />
              </span>
            </span>
          </div>
          {invoiceDateParseError ? (
            <p id="d-date-error" className="mt-1 text-xs text-red-600" role="alert">
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
            <span className="ms-1 font-normal text-zinc-500">(אופציונלי)</span>
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
          <label htmlFor="d-inv-no" className="mb-1 block text-sm text-zinc-700">
            מספר חשבונית / קבלה
            <span className="ms-1 font-normal text-zinc-500">(אופציונלי)</span>
          </label>
          <input
            id="d-inv-no"
            type="text"
            inputMode="text"
            autoComplete="off"
            value={finalInvoiceNumber}
            disabled={!finalEditable}
            onChange={(e) => setFinalInvoiceNumber(e.target.value)}
            placeholder="למשל 12345 או INV-2026-01"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          />
          {initial.extractedInvoiceNumber?.trim() ? (
            <p className="mt-1 text-xs text-zinc-500">
              זוהה במסמך: {initial.extractedInvoiceNumber.trim()}
            </p>
          ) : null}
          {submitErrors?.finalInvoiceNumber ? (
            <p className="mt-1 text-xs text-red-600">
              {submitErrors.finalInvoiceNumber.join(" · ")}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="d-note" className="mb-1 block text-sm text-zinc-700">
            הערה
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
            {status === "approved"
              ? "המסמך אושר על ידי רואה החשבון — אין עריכה מתוך מסך זה."
              : status === "submitted"
                ? "המסמך הוגש לרואה החשבון — מתוך מסך זה אין עריכה. לשינויים בפרטי החשבונית פנו לרו״ח (הוא יכול לעדכן אצלה במערכת)."
                : "לא ניתן לערוך מסמך במצב זה."}
          </p>
        )}
      </form>
    </div>
  );
}
