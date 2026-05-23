"use client";

import { useEffect, useRef, useState } from "react";

function isPdfMime(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  return m.startsWith("application/pdf");
}

/** Chrome/Android (ובדפדפנים ניידים) לעיתים מציגים PDF בתוך iframe עם כפתור "Open" שבור על blob: — במקום זה פותחים בלשונית חדשה מחוות משתמש. */
function usePreferOpeningPdfExternally(): boolean {
  const [prefer, setPrefer] = useState(false);

  useEffect(() => {
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    const mqNarrow = window.matchMedia("(max-width: 640px)");
    const update = () =>
      setPrefer(mqCoarse.matches || mqNarrow.matches);

    update();
    mqCoarse.addEventListener("change", update);
    mqNarrow.addEventListener("change", update);
    return () => {
      mqCoarse.removeEventListener("change", update);
      mqNarrow.removeEventListener("change", update);
    };
  }, []);

  return prefer;
}

export type DocumentFileViewerOverlayProps = {
  /** מזהה לשכבת טעינה מחדש כשמחליפים מסמך (למשל id) */
  viewerKey: string;
  /** מ־שורת המסמך — נופל לאחור אם ל־Blob אין `type` אחרי הורדה */
  mimeTypeHint: string;
  onClose: () => void;
  /** טעינת תגובת הקובץ מאותו מקור העלאה (כולל `credentials: same-origin`) */
  fetchFile: () => Promise<Response>;
};

async function loadIntoObjectUrl(fetchFile: () => Promise<Response>): Promise<{
  objectUrl: string;
  viewerMime: string;
}> {
  const res = await fetchFile();
  const headerMime =
    res.headers.get("Content-Type")?.split(";")[0]?.trim() ?? "";

  if (!res.ok) {
    let apiMessage = `שגיאה ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) apiMessage = j.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(apiMessage);
  }

  const blob = await res.blob();
  const viewerMime = (blob.type || headerMime).trim();
  const objectUrl = URL.createObjectURL(blob);
  return { objectUrl, viewerMime };
}

/**
 * צפייה במודאל עם fetch מפורש (+ קוקי סשן כמו בשאר האפליקציה).
 * ניווט מוטמע (`img`/`iframe` ישר ל־URL) וב־PWA/WebViews לפעמים לא משגר קוקי — ומתקבל 404 מהשרת.
 */
export function DocumentFileViewerOverlay({
  viewerKey,
  mimeTypeHint,
  onClose,
  fetchFile,
}: DocumentFileViewerOverlayProps) {
  type ViewerPhase =
    | { kind: "loading" }
    | {
        kind: "ready";
        objectUrl: string;
        isImage: boolean;
        effectiveMime: string;
      }
    | { kind: "error"; message: string };

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const fetchRef = useRef(fetchFile);
  fetchRef.current = fetchFile;
  const preferExternalPdf = usePreferOpeningPdfExternally();
  const [phase, setPhase] = useState<ViewerPhase>({ kind: "loading" });

  useEffect(() => {
    setPhase({ kind: "loading" });
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const loaded = await loadIntoObjectUrl(() => fetchRef.current());
        const hintMime = mimeTypeHint.trim().toLowerCase();
        const effective =
          loaded.viewerMime.length > 0
            ? loaded.viewerMime.toLowerCase()
            : hintMime;
        const isImage = effective.startsWith("image/");
        objectUrl = loaded.objectUrl;
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setPhase({
          kind: "ready",
          objectUrl: loaded.objectUrl,
          isImage,
          effectiveMime: effective,
        });
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof Error
            ? e.message
            : "לא ניתן לטעון את הקובץ. ניתן לנסות שוב בעוד רגע.";
        setPhase({ kind: "error", message: msg });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mimeTypeHint, viewerKey]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (phase.kind !== "loading") {
      window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    }
  }, [phase]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-file-viewer-title"
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
          <h2 id="doc-file-viewer-title" className="text-sm font-semibold text-zinc-900">
            תצוגת המסמך
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            סגירה
          </button>
        </div>
        <div className="relative min-h-0 flex-1 bg-zinc-100">
          {phase.kind === "loading" ? (
            <div className="flex size-full items-center justify-center p-6 text-sm text-zinc-700">
              טוענים את הקובץ…
            </div>
          ) : null}

          {phase.kind === "error" ? (
            <div className="flex size-full flex-col justify-center gap-3 p-6 text-center">
              <p className="text-sm text-red-700" role="alert">
                {phase.message}
              </p>
              <button
                type="button"
                className="mx-auto rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50"
                onClick={onClose}
              >
                סגירה
              </button>
            </div>
          ) : null}

          {phase.kind === "ready" && phase.isImage ? (
            <div className="size-full overflow-auto p-2 sm:p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phase.objectUrl}
                alt=""
                className="mx-auto block max-h-full max-w-full object-contain"
              />
            </div>
          ) : null}

          {phase.kind === "ready" &&
          !phase.isImage &&
          preferExternalPdf &&
          isPdfMime(phase.effectiveMime) ? (
            <div className="flex size-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <p className="max-w-md text-sm leading-relaxed text-zinc-700">
                בטלפונים ובכרום אנדרואיד PDF בתוך המסגרת לא תמיד עובד. כדי לקרוא את
                הקובץ, יש לפתוח אותו בלשונית או בתצוגה מלאה של הדפדפן.
              </p>
              <a
                href={phase.objectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-teal-700 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-800 active:bg-teal-950"
              >
                פתיחת הקובץ
              </a>
            </div>
          ) : null}

          {phase.kind === "ready" &&
          !phase.isImage &&
          !(preferExternalPdf && isPdfMime(phase.effectiveMime)) ? (
            <iframe
              title="תוכן המסמך"
              src={phase.objectUrl}
              className="absolute inset-0 size-full bg-white"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
