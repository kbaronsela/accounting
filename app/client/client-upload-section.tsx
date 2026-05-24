"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { RequiredFieldMark } from "@/app/client/required-field-mark";
import type { ClientMeClientRow } from "@/lib/client/queries";
import {
  assessImagePreUploadQuality,
  preUploadQualityOptionsFromPublicEnv,
} from "@/lib/client/image-pre-upload-quality";
import { completeUploadRobust } from "@/lib/client/upload-complete-robust";
import { isAllowedUploadMime } from "@/lib/uploads/config";
import { parseJsonBodyFromFetchResponse } from "@/lib/client/fetch-response-json";

/** כל סוגי הקבצים המותרים בבורר קבצים (ללא מאפיין capture) */
const FILE_ACCEPT_HINT =
  ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

function guessMime(file: File): string | null {
  const t = file.type?.trim();
  if (t && isAllowedUploadMime(t)) return t;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}

function fileFingerprint(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

type UploadsCreateJson = {
  documentId?: string;
  upload?: {
    url: string;
    method: string;
    headers: Record<string, string>;
  };
  error?: { message?: string };
};

type UploadErrorEnvelope = {
  error?: {
    message?: string;
    details?: { upstream?: string };
  };
};

function messageForFailedUploadStep(
  res: Response,
  apiMessage: string | null | undefined,
  fallbackShort: string,
): string {
  const trimmed =
    typeof apiMessage === "string" ? apiMessage.trim() : "";
  if (trimmed.length > 0) return trimmed;
  if (res.status === 413) {
    return "הקובץ גדול מדי בשביל נתיב השרת הנוכחי. נסו קובץ קטן יותר או Wi‑Fi/רשת יציבה.";
  }
  return `${fallbackShort} (קוד ${res.status}).`;
}

type Props = {
  clients: ClientMeClientRow[];
};

export function ClientUploadSection({ clients }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const mobilePickInputRef = useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);
  /** אישור להעלאה למרות בדיקת איכות (טשטוש / חשיכה) */
  const qualityBypassRef = useRef(new Set<string>());
  const [clientId, setClientId] = useState(
    clients.length === 1 ? clients[0].id : "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [qualityChecking, setQualityChecking] = useState(false);
  const [qualityHold, setQualityHold] = useState<{
    blur: boolean;
    dark: boolean;
  } | null>(null);
  /** עומק כניסה/יציאה מגרירה — מפחית „הבהוב” עם אלמנטים פנימיים */
  const [desktopDragDepth, setDesktopDragDepth] = useState(0);

  if (clients.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-zinc-900">העלאת מסמך</h2>
        <p className="mt-2 text-sm text-zinc-600">
          כדי להעלות מסמכים צריך תיק משויך. אם קיבלת הזמנה — יש להשלים הרשמה
          מקישור ההזמנה.
        </p>
      </section>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!clientId) {
      setError("נא לבחור תיק.");
      return;
    }
    if (!file) {
      setError("נא לבחור קובץ.");
      return;
    }
    const mimeType = guessMime(file);
    if (!mimeType) {
      setError("סוג הקובץ לא נתמך. מותר: PDF, JPEG, PNG, WebP.");
      return;
    }

    if (
      mimeType.startsWith("image/") &&
      !qualityBypassRef.current.has(fileFingerprint(file))
    ) {
      setQualityChecking(true);
      try {
        const ass = await assessImagePreUploadQuality(file, {
          ...preUploadQualityOptionsFromPublicEnv(),
        });
        if (ass.ok && (ass.likelyBlurry || ass.likelyTooDark)) {
          setQualityHold({
            blur: ass.likelyBlurry,
            dark: ass.likelyTooDark,
          });
          return;
        }
      } catch {
        /* אם לא ניתן לנתח בדפדפן — ממשיכים להעלאה */
      } finally {
        setQualityChecking(false);
      }
    }

    setPending(true);
    try {
      const createRes = await fetch("/api/client/documents/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          clientId,
          mimeType,
          byteSize: file.size,
        }),
      });
      const { json: createData } =
        await parseJsonBodyFromFetchResponse<UploadsCreateJson>(createRes);

      if (!createRes.ok) {
        setError(
          messageForFailedUploadStep(
            createRes,
            createData?.error?.message,
            "יצירת מסמך נכשלה",
          ),
        );
        setPending(false);
        return;
      }
      const upload = createData?.upload;
      const documentId = createData?.documentId;
      if (!upload || !documentId || !createData) {
        setError("תגובת שרת לא צפויה.");
        setPending(false);
        return;
      }

      /**
       * URL יחסי — תמיד אותה מקור כמו העמוד. אם משתמשים ב־`upload.url`
       * המוחזק מגוף `AUTH_URL` (למשל localhost), מהטלפון בפריסת LAN
       * ה־PUT היה נשלח ל־localhost של המכשיר ונופל בשגיאת רשת.
       */
      const putPath = `/api/client/documents/${documentId}/upload`;
      const putRes = await fetch(putPath, {
        method: upload.method || "PUT",
        credentials: "same-origin",
        headers: upload.headers || { "Content-Type": mimeType },
        body: file,
      });
      const { json: putJson } =
        await parseJsonBodyFromFetchResponse<UploadErrorEnvelope>(putRes);
      if (!putRes.ok) {
        let msg = messageForFailedUploadStep(
          putRes,
          putJson?.error?.message,
          "העלאת הקובץ נכשלה",
        );
        const up = putJson?.error?.details?.upstream?.trim();
        if (up) msg = `${msg} (${up})`;
        setError(msg);
        setPending(false);
        return;
      }

      const done = await completeUploadRobust(documentId);
      if (!done.ok) {
        setError(
          done.errorMessage ??
            "השלמת ההעלאה נכשלה. אפשר לנסות «להשלים העלאה» מהדשבורד אם הקובץ כבר בשרת.",
        );
        setPending(false);
        return;
      }

      setMessage("הקובץ הועלה בהצלחה.");
      setFile(null);
      resetAllFileInputs();
      router.refresh();
    } catch (err: unknown) {
      const aborted =
        typeof err === "object" &&
        err !== null &&
        (err as { name?: string }).name === "AbortError";
      setError(
        aborted
          ? "העלאה בוטלה."
          : "שגיאת רשת או הפסקת החיבור. בדקו את הרשת ונסו שוב; עם קבצים גדולים השתמשו ב‑Wi‑Fi יציב.",
      );
    }
    setPending(false);
  }

  function onQualityChooseAnother() {
    setQualityHold(null);
    setFile(null);
    resetAllFileInputs();
  }

  function onQualityUploadAnyway() {
    if (!file) return;
    qualityBypassRef.current.add(fileFingerprint(file));
    setQualityHold(null);
    formRef.current?.requestSubmit();
  }

  function clearTwinMobileInputs(picked: "pick" | "camera") {
    if (picked === "pick" && mobileCameraInputRef.current) {
      mobileCameraInputRef.current.value = "";
    }
    if (picked === "camera" && mobilePickInputRef.current) {
      mobilePickInputRef.current.value = "";
    }
  }

  function resetAllFileInputs() {
    setDesktopDragDepth(0);
    if (desktopFileInputRef.current) desktopFileInputRef.current.value = "";
    if (mobilePickInputRef.current) mobilePickInputRef.current.value = "";
    if (mobileCameraInputRef.current) mobileCameraInputRef.current.value = "";
  }

  function assignDesktopDroppedFile(next: File | null) {
    qualityBypassRef.current.clear();
    setQualityHold(null);
    setDesktopDragDepth(0);
    setFile(next);
    if (desktopFileInputRef.current) desktopFileInputRef.current.value = "";
  }

  function onDesktopDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDesktopDragDepth((d) => d + 1);
  }

  function onDesktopDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDesktopDragDepth((d) => Math.max(0, d - 1));
  }

  function onDesktopDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDesktopDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0];
    assignDesktopDroppedFile(dropped ?? null);
  }

  function onMobilePickChange(e: React.ChangeEvent<HTMLInputElement>) {
    clearTwinMobileInputs("pick");
    qualityBypassRef.current.clear();
    setQualityHold(null);
    setFile(e.target.files?.[0] ?? null);
  }

  function onMobileCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    clearTwinMobileInputs("camera");
    qualityBypassRef.current.clear();
    setQualityHold(null);
    setFile(e.target.files?.[0] ?? null);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-zinc-900">העלאת מסמך</h2>
      <p className="mt-1 text-sm text-zinc-600">
        PDF או תמונה, עד 20MB למסמך.
      </p>
      <form
        ref={formRef}
        className="mt-4 flex flex-col gap-3"
        dir="rtl"
        onSubmit={onSubmit}
      >
        {clients.length > 1 ? (
          <div>
            <label
              htmlFor="upload-client"
              className="mb-1 flex flex-wrap items-center gap-0 text-sm text-zinc-700"
            >
              תיק
              <RequiredFieldMark />
            </label>
            <select
              id="upload-client"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              <option value="">יש לבחור תיק…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {/* דסקטופ (מ־640px ומעלה): בורר קבצים וגרירה מהמחשב */}
        <div className="hidden sm:block">
          <label
            htmlFor="upload-file-desktop"
            className="mb-1 flex flex-wrap items-center gap-0 text-sm text-zinc-700"
          >
            קובץ
            <RequiredFieldMark />
          </label>
          <div
            role="presentation"
            onDragEnter={onDesktopDragEnter}
            onDragLeave={onDesktopDragLeave}
            onDragOver={onDesktopDragOver}
            onDrop={onDesktopDrop}
            className={`mt-1 rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
              desktopDragDepth > 0
                ? "border-emerald-600 bg-emerald-50/80"
                : "border-zinc-200 bg-zinc-50/60"
            }`}
          >
            <input
              ref={desktopFileInputRef}
              id="upload-file-desktop"
              type="file"
              accept={FILE_ACCEPT_HINT}
              className="block w-full text-sm text-zinc-600 file:me-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:font-medium file:text-zinc-800"
              onChange={(e) => {
                qualityBypassRef.current.clear();
                setQualityHold(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
            <p className="mt-3 text-xs text-zinc-500">
              אפשר לגרור לכאן קובץ מהמחשב (למשל מתיקייה או משולחן העבודה), או
              לבחור מתוך הדף.
            </p>
            {file ? (
              <p className="mt-2 text-xs text-zinc-600">
                נבחר:{" "}
                <span className="font-medium text-zinc-800">{file.name}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* מובייל (מתחת ל־640px): צילום או בחירת קובץ */}
        <div className="space-y-2 sm:hidden">
          <span className="flex flex-wrap items-center gap-0 text-sm text-zinc-700">
            קבלה / מסמך
            <RequiredFieldMark />
          </span>
          <input
            ref={mobileCameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            onChange={onMobileCameraChange}
          />
          <input
            ref={mobilePickInputRef}
            id="upload-file-mobile-pick"
            type="file"
            accept={FILE_ACCEPT_HINT}
            className="sr-only"
            onChange={onMobilePickChange}
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-label="צילום קבלה במצלמה"
              className="w-full rounded-md border border-emerald-800 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
              onClick={() => mobileCameraInputRef.current?.click()}
            >
              צילום קבלה
            </button>
            <button
              type="button"
              aria-label="בחירת קובץ: PDF או תמונה מהגלריה"
              className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              onClick={() => mobilePickInputRef.current?.click()}
            >
              בחירת קובץ (PDF או תמונה מהגלריה)
            </button>
          </div>
          {file ? (
            <p className="text-xs text-zinc-600">
              נבחר:{" "}
              <span className="font-medium text-zinc-800">{file.name}</span>
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              טרם נבחר קובץ — יש להשתמש באחד מהכפתורים למעלה.
            </p>
          )}
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
        {qualityHold ? (
          <div
            className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 shadow-sm"
            role="alert"
          >
            <p className="font-medium">
              {qualityHold.blur && qualityHold.dark
                ? "נראה שהתמונה פחות מתאימה לזיהוי (חשוכה ו/או לא חדה)"
                : qualityHold.blur
                  ? "נראה שהתמונה מטושטשת או לא חדה מספיק"
                  : "התמונה נראית חשוכה מדי"}
            </p>
            <ul className="mt-2 list-disc space-y-1 pe-4 text-xs text-amber-900/95">
              {qualityHold.blur ? (
                <li>
                  לצילום חד: ייצוב המכשיר, מסמך במוקד, תאורה אחידה — משפרים OCR.
                </li>
              ) : null}
              {qualityHold.dark ? (
                <li>
                  לתאורה טובה יותר: מומלץ להדליק אור, להניח את הקבלה על רקע בהיר,
                  או להשתמש במבזק/פנס במצלמה.
                </li>
              ) : null}
            </ul>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => onQualityChooseAnother()}
                className="rounded-md border border-amber-800 bg-white px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
              >
                לבחור תמונה או לצלם תמונה חדשה
              </button>
              <button
                type="button"
                onClick={() => onQualityUploadAnyway()}
                className="rounded-md border border-transparent bg-zinc-800 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-900"
              >
                העלאה בכל זאת
              </button>
            </div>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={pending || qualityChecking || qualityHold !== null}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {qualityChecking
            ? "בודקים איכות תמונה…"
            : pending
              ? "מעלים…"
              : "העלה"}
        </button>
      </form>
    </section>
  );
}
