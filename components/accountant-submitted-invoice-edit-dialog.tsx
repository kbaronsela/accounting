"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { SHEKEL_DISPLAY } from "@/lib/client/currency-canonical";
import {
  isoDateToDisplay,
  parseFlexibleInvoiceDate,
  parseStoredIsoDate,
  todayIsoLocal,
} from "@/lib/client/date-input-helpers";
import { finalInvoiceAmountInputValueFromStored } from "@/lib/invoice-final-amount";
import {
  appModalCenteredPaperClass,
  appModalGhostButtonClass,
  appModalHeaderClass,
  appModalPrimaryButtonClass,
  appModalInputClass,
  appModalCloseButtonClass,
} from "@/lib/ui/modal-classes";

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

type AccountantDocDetailPayload = {
  id: string;
  clientDisplayName: string;
  status: string;
  finalAmount: string | null;
  finalCurrency: string | null;
  finalDate: string | null;
  finalVendor: string | null;
  finalInvoiceNumber: string | null;
  extractedInvoiceNumber: string | null;
  clientNote: string | null;
  submittedAt: string | null;
  mimeType: string;
  editableInvoiceFields: boolean;
};

type Props = {
  documentId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function AccountantSubmittedInvoiceEditDialog({
  documentId,
  onClose,
  onSaved,
}: Props) {
  const titleId = useId();

  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<AccountantDocDetailPayload | null>(
    null,
  );

  const [finalAmount, setFinalAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState({ iso: "", display: "" });
  const [invoiceDateParseError, setInvoiceDateParseError] = useState<
    string | null
  >(null);
  const [finalVendor, setFinalVendor] = useState("");
  const [finalInvoiceNumber, setFinalInvoiceNumber] = useState("");
  const [clientNote, setClientNote] = useState("");

  const [submitErrors, setSubmitErrors] = useState<Record<
    string,
    string[]
  > | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, saving]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const res = await fetch(
          `/api/accountants/me/documents/${documentId}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        const data = (await res.json()) as
          | AccountantDocDetailPayload
          | { error?: { message?: string } };

        if (!res.ok || !("editableInvoiceFields" in data && data.id)) {
          const msg =
            "error" in data && data.error?.message
              ? data.error.message
              : "לא ניתן לטעון את המסמך.";
          if (!cancelled) setLoadErr(msg);
          return;
        }
        const row = data as AccountantDocDetailPayload;
        if (!row.editableInvoiceFields) {
          if (!cancelled) {
            setLoadErr(
              "לא ניתן לערוך שדות חשבונית במסמך זה במצב הנוכחי.",
            );
          }
          return;
        }
        if (!cancelled) {
          setPayload(row);
          setFinalAmount(finalInvoiceAmountInputValueFromStored(row.finalAmount));
          const iso = parseStoredIsoDate(row.finalDate);
          setInvoiceDate(
            iso
              ? { iso, display: isoDateToDisplay(iso) }
              : { iso: "", display: "" },
          );
          setFinalVendor(row.finalVendor ?? "");
          setFinalInvoiceNumber(row.finalInvoiceNumber ?? "");
          setClientNote(row.clientNote ?? "");
        }
      } catch {
        if (!cancelled) setLoadErr("שגיאת רשת.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const flushInvoiceDateFromDisplay = useCallback((): boolean => {
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
  }, [invoiceDate.display]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitErrors(null);
    if (!flushInvoiceDateFromDisplay()) {
      setFormError("יש לבדוק את שדה התאריך.");
      return;
    }

    const amt = finalAmount.trim();
    const body = {
      finalAmount: amt === "" ? null : amt,
      finalCurrency: amt ? SHEKEL_DISPLAY : null,
      finalDate: invoiceDate.iso.trim() === "" ? null : invoiceDate.iso,
      finalVendor: finalVendor.trim() === "" ? null : finalVendor.trim(),
      finalInvoiceNumber:
        finalInvoiceNumber.trim() === "" ? null : finalInvoiceNumber.trim(),
      clientNote: clientNote.trim() === "" ? null : clientNote.trim(),
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/accountants/me/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: {
          message?: string;
          details?: { fields?: Record<string, string[]> };
        };
      };

      if (!res.ok) {
        const fields = data.error?.details?.fields as
          | Record<string, string[]>
          | undefined;
        if (res.status === 422 && fields && Object.keys(fields).length > 0) {
          setSubmitErrors(fields);
          setFormError(data.error?.message ?? "יש לבדוק את השדות.");
        } else {
          setFormError(data.error?.message ?? "שמירה נכשלה.");
        }
        setSaving(false);
        return;
      }

      onSaved();
      onClose();
      setSaving(false);
    } catch {
      setFormError("שגיאת רשת.");
      setSaving(false);
    }
  }

  function handleBackdropClick() {
    if (!saving) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-teal-950/45 px-4 py-6 backdrop-blur-[2px] sm:items-center sm:px-3 sm:py-10"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleBackdropClick();
      }}
    >
      <div
        className={`${appModalCenteredPaperClass} relative my-auto max-h-[calc(100dvh-6rem)] w-full`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir="rtl"
      >
        <button
          type="button"
          className={`${appModalCloseButtonClass} end-4 top-[0.875rem] z-30`}
          aria-label="סגירה"
          disabled={saving}
          onClick={handleBackdropClick}
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>

        {loading ? (
          <p className="py-12 text-center text-sm text-zinc-600">
            טוענים את פרטי המסמך…
          </p>
        ) : loadErr || !payload ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-700" role="alert">
              {loadErr ?? "לא ניתן להציג עריכה."}
            </p>
            <button
              type="button"
              className={`mt-4 inline-flex ${appModalGhostButtonClass}`}
              onClick={onClose}
            >
              סגירה
            </button>
          </div>
        ) : (
          <>
            <div className={`${appModalHeaderClass} border-b pb-11 pe-14`}>
              <h2 id={titleId} className="text-lg font-semibold text-teal-950">
                עריכת נתוני חשבונית
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                לקוח:{" "}
                <span className="font-medium text-zinc-800">
                  {payload.clientDisplayName}
                </span>
              </p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="acct-ed-amt"
                  className="mb-1 inline-flex flex-wrap items-center gap-0 text-sm text-zinc-700"
                >
                  סכום סופי
                </label>
                <input
                  id="acct-ed-amt"
                  type="text"
                  inputMode="decimal"
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(e.target.value)}
                  disabled={saving}
                  className={`w-full ${appModalInputClass} disabled:bg-teal-50/50`}
                />
                {submitErrors?.finalAmount ? (
                  <p className="mt-1 text-xs text-red-600">
                    {submitErrors.finalAmount.join(" · ")}
                  </p>
                ) : null}
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="acct-ed-date-display"
                  className="mb-1 inline-flex flex-wrap items-center gap-0 text-sm text-zinc-700"
                >
                  תאריך חשבונית (DD.MM.YYYY)
                </label>
                <div className="flex min-w-0 flex-row flex-nowrap items-stretch gap-0">
                  <input
                    id="acct-ed-date-display"
                    type="text"
                    placeholder={`למשל ${isoDateToDisplay(todayIsoLocal())}`}
                    inputMode="numeric"
                    autoComplete="off"
                    value={invoiceDate.display}
                    disabled={saving}
                    onChange={(e) => {
                      setInvoiceDateParseError(null);
                      const v = e.target.value;
                      const parsed = parseFlexibleInvoiceDate(v);
                      setInvoiceDate((p) =>
                        parsed.ok ? { iso: parsed.iso, display: v } : { ...p, display: v },
                      );
                    }}
                    onBlur={() => flushInvoiceDateFromDisplay()}
                    className={`min-w-0 flex-1 rounded-s-xl rounded-e-none border border-teal-200/90 border-e-0 px-3 py-2 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/25 disabled:bg-teal-50/50`}
                    aria-invalid={invoiceDateParseError ? true : undefined}
                  />
                  <span className="relative inline-flex h-10 w-11 shrink-0 items-stretch rounded-e-xl rounded-s-none border border-teal-200/90 border-s-0 bg-white -ms-px">
                    <input
                      type="date"
                      tabIndex={-1}
                      value={parseStoredIsoDate(invoiceDate.iso) ?? ""}
                      disabled={saving}
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
                      aria-label="בחירת תאריך"
                      title="בחירת תאריך"
                      className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                    <span className="pointer-events-none inline-flex flex-1 items-center justify-center text-teal-800/70">
                      <CalendarIcon />
                    </span>
                  </span>
                </div>
                {invoiceDateParseError ? (
                  <p className="mt-1 text-xs text-red-600">{invoiceDateParseError}</p>
                ) : null}
                {submitErrors?.finalDate ? (
                  <p className="mt-1 text-xs text-red-600">
                    {submitErrors.finalDate.join(" · ")}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="acct-ed-vendor"
                  className="mb-1 inline-flex flex-wrap items-center gap-0 text-sm text-zinc-700"
                >
                  ספק / שם העסק
                </label>
                <input
                  id="acct-ed-vendor"
                  type="text"
                  value={finalVendor}
                  disabled={saving}
                  onChange={(e) => setFinalVendor(e.target.value)}
                  className={`w-full ${appModalInputClass} disabled:bg-teal-50/50`}
                />
                {submitErrors?.finalVendor ? (
                  <p className="mt-1 text-xs text-red-600">
                    {submitErrors.finalVendor.join(" · ")}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="acct-ed-inv-no"
                  className="mb-1 block text-sm text-zinc-700"
                >
                  מספר חשבונית / קבלה
                </label>
                <input
                  id="acct-ed-inv-no"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  value={finalInvoiceNumber}
                  disabled={saving}
                  onChange={(e) => setFinalInvoiceNumber(e.target.value)}
                  placeholder="למשל 12345 או INV-2026-01"
                  className={`w-full ${appModalInputClass} disabled:bg-teal-50/50`}
                />
                {payload?.extractedInvoiceNumber?.trim() ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    זוהה במסמך: {payload.extractedInvoiceNumber.trim()}
                  </p>
                ) : null}
                {submitErrors?.finalInvoiceNumber ? (
                  <p className="mt-1 text-xs text-red-600">
                    {submitErrors.finalInvoiceNumber.join(" · ")}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="acct-ed-note"
                  className="mb-1 block text-sm text-zinc-700"
                >
                  הערת לקוח
                </label>
                <textarea
                  id="acct-ed-note"
                  rows={3}
                  value={clientNote}
                  disabled={saving}
                  onChange={(e) => setClientNote(e.target.value)}
                  className={`w-full ${appModalInputClass} resize-y disabled:bg-teal-50/50`}
                />
              </div>

              {formError ? (
                <p className="text-sm text-red-700" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className={appModalPrimaryButtonClass}
                >
                  {saving ? "שומרים…" : "שמירת שינויים"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className={appModalGhostButtonClass}
                  onClick={onClose}
                >
                  ביטול
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
