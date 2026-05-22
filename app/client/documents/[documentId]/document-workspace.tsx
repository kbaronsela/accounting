"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DraftUploadResumeButton } from "@/app/client/draft-upload-resume-button";
import {
  SHEKEL_DISPLAY,
  canonicalizeCurrency,
} from "@/lib/client/currency-canonical";
import {
  isoDateToDisplay,
  parseFlexibleInvoiceDate,
  parseStoredIsoDate,
  todayIsoLocal,
} from "@/lib/client/date-input-helpers";

type ClientCurrencyCode = typeof SHEKEL_DISPLAY | "USD" | "EUR";

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
  clientNote: string | null;
  submittedAt: string | null;
  editable: boolean;
};

const CURRENCY_OPTIONS: { code: ClientCurrencyCode; label: string }[] = [
  { code: SHEKEL_DISPLAY, label: SHEKEL_DISPLAY },
  { code: "USD", label: "\u05D3\u05D5\u05DC\u05E8" },
  { code: "EUR", label: "\u05D9\u05D5\u05E8\u05D5" },
];

function coerceSelectableCurrency(raw: string | null | undefined): ClientCurrencyCode {
  const c = canonicalizeCurrency(raw);
  if (c === "USD" || c === "EUR") return c;
  return SHEKEL_DISPLAY;
}

const STATUS_LABELS: Record<string, string> = {
  draft_uploading: "טעינת קובץ",
  uploaded: "הועלה",
  ocr_processing: "עיבוד OCR",
  needs_review: "דורש בדיקה",
  ocr_failed: "כשל ב־OCR",
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

type ClientDocumentFileViewerProps = {
  mimeType: string;
  fileUrl: string;
  onClose: () => void;
  closeRef: React.RefObject<HTMLButtonElement | null>;
};

/** תצוגה פנימית — ב־PWA במובייל `target=_blank` מחליף את האפליקציה וב־ESC נסגרת כולה במקום הלשונית */
function ClientDocumentFileViewerOverlay({
  mimeType,
  fileUrl,
  onClose,
  closeRef,
}: ClientDocumentFileViewerProps) {
  const preferImageViewer = mimeType.trim().toLowerCase().startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-doc-viewer-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="סגירת תצוגת הקובץ"
        onClick={onClose}
      />
      <div
        dir="rtl"
        className="relative z-10 flex h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-zinc-50 shadow-2xl sm:h-[min(90dvh,920px)] sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-3 py-2.5 sm:px-4">
          <h2 id="client-doc-viewer-title" className="text-sm font-semibold text-zinc-900">
            תצוגת המסמך
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            סגירה
          </button>
        </div>
        <div className="relative min-h-0 flex-1 bg-zinc-100">
          {preferImageViewer ? (
            <div className="size-full overflow-auto p-2 sm:p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- הצגת מסמך מאות origin עם קוקי הסשן (לא מתאים ל־next/image) */}
              <img
                src={fileUrl}
                alt=""
                className="mx-auto block max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <iframe title="תוכן המסמך" src={fileUrl} className="absolute inset-0 size-full bg-white" />
          )}
        </div>
      </div>
    </div>
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

  const viewerCloseBtnRef = useRef<HTMLButtonElement>(null);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [showNewTabFileLink, setShowNewTabFileLink] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        const standaloneLike =
          window.matchMedia("(display-mode: standalone)").matches ||
          Boolean(
            (window.navigator as Navigator & { standalone?: boolean }).standalone,
          );
        const wideEnough = window.matchMedia("(min-width: 640px)").matches;
        setShowNewTabFileLink(wideEnough && !standaloneLike);
      } catch {
        setShowNewTabFileLink(false);
      }
    };
    sync();
    const mqStandalone = window.matchMedia("(display-mode: standalone)");
    const mqWide = window.matchMedia("(min-width: 640px)");
    mqStandalone.addEventListener("change", sync);
    mqWide.addEventListener("change", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      mqStandalone.removeEventListener("change", sync);
      mqWide.removeEventListener("change", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  useEffect(() => {
    if (!fileViewerOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => {
      viewerCloseBtnRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
    };
  }, [fileViewerOpen]);

  useEffect(() => {
    if (!fileViewerOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setFileViewerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [fileViewerOpen]);

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
      setError("יש לבדוק את שדה התאריך.");
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
      setError("יש לבדוק את שדה התאריך לפני ההגשה.");
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
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-800">קבצים</p>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={() => setFileViewerOpen(true)}
              className="block text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
            >
              הצגת הקובץ
            </button>
            {showNewTabFileLink ? (
              <p className="text-xs text-zinc-600">
                <a
                  href={`/api/client/documents/${initial.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline-offset-4 hover:underline"
                >
                  פתיחה בלשונית חדשה
                </a>{" "}
                — נוח בעיקר במחשב
              </p>
            ) : (
              <p className="text-xs text-zinc-600">
                בתצוגת אפליקציה במובייל ההצגה היא בתוך המסך; לסיום התצוגה יש להשתמש
                ב־«סגירה» (ולא בהקשה על Esc שעלול לסגור את האפליקציה).
              </p>
            )}
          </div>
          {fileViewerOpen
            ? createPortal(
                <ClientDocumentFileViewerOverlay
                  mimeType={initial.mimeType}
                  fileUrl={`/api/client/documents/${initial.id}/file`}
                  onClose={() => setFileViewerOpen(false)}
                  closeRef={viewerCloseBtnRef}
                />,
                document.body,
              )
            : null}
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
              setFinalCurrencyCode(e.target.value as ClientCurrencyCode)
            }
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            {CURRENCY_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.code === SHEKEL_DISPLAY ? o.label : `${o.label} (${o.code})`}
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
