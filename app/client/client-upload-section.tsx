"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ClientMeClientRow } from "@/lib/client/queries";
import {
  assessImagePreUploadQuality,
  preUploadQualityOptionsFromPublicEnv,
} from "@/lib/client/image-pre-upload-quality";
import { completeUploadRobust } from "@/lib/client/upload-complete-robust";
import { isAllowedUploadMime } from "@/lib/uploads/config";

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

  if (clients.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-zinc-900">העלאת מסמך</h2>
        <p className="mt-2 text-sm text-zinc-600">
          כדי להעלות מסמכים צריך תיק משויך. אם קיבלת הזמנה — השלימי הרשמה מקישור
          ההזמנה.
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
      const createData = (await createRes.json()) as {
        documentId?: string;
        upload?: {
          url: string;
          method: string;
          headers: Record<string, string>;
        };
        error?: { message?: string };
      };
      if (!createRes.ok) {
        setError(createData.error?.message ?? "יצירת מסמך נכשלה.");
        setPending(false);
        return;
      }
      const upload = createData.upload;
      const documentId = createData.documentId;
      if (!upload || !documentId) {
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
      if (!putRes.ok) {
        setError("העלאת הקובץ נכשלה. נסי שוב.");
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
    } catch {
      setError("שגיאת רשת.");
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
    if (desktopFileInputRef.current) desktopFileInputRef.current.value = "";
    if (mobilePickInputRef.current) mobilePickInputRef.current.value = "";
    if (mobileCameraInputRef.current) mobileCameraInputRef.current.value = "";
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
        קבלות ומסמכים (PDF או תמונה), עד 20 מ״ב. במסכים צרים אפשר לצלם או לבחור קובץ;
        במחשב — העלאת קובץ בלבד. בפיתוח הקבצים נשמרים בתיקייה מקומית (
        <code className="rounded bg-zinc-100 px-1 text-xs">.data/uploads</code>
        ).
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
              className="mb-1 block text-sm text-zinc-700"
            >
              תיק
            </label>
            <select
              id="upload-client"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              <option value="">בחרי תיק…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {/* דסקטופ (מ־640px ומעלה): בורר קבצים בלבד, בלי מאפיין capture */}
        <div className="hidden sm:block">
          <label
            htmlFor="upload-file-desktop"
            className="mb-1 block text-sm text-zinc-700"
          >
            קובץ
          </label>
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
        </div>

        {/* מובייל (מתחת ל־640px): צילום או בחירת קובץ */}
        <div className="space-y-2 sm:hidden">
          <span className="block text-sm text-zinc-700">קבלה / מסמך</span>
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
              טרם נבחר קובץ — השתמשי באחד מהכפתורים למעלה.
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
                  לתאורה טובה יותר: נסי להדליק אור, להניח את הקבלה על רקע בהיר,
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
                אבחר / אצלם תמונה חדשה
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
              : "העלאה"}
        </button>
      </form>
    </section>
  );
}
