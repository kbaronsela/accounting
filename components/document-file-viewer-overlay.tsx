"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  appModalBackdropClass,
  appModalGhostButtonClass,
  appModalHeaderClass,
} from "@/lib/ui/modal-classes";

function isPdfMime(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  return m.startsWith("application/pdf");
}

/** סיומת קובץ להורדה לפי סוג MIME (נופל ל־bin). */
function extensionForMime(mime: string): string {
  const m = mime.trim().toLowerCase();
  if (m.startsWith("image/jpeg") || m.startsWith("image/jpg")) return "jpg";
  if (m.startsWith("image/png")) return "png";
  if (m.startsWith("image/webp")) return "webp";
  if (m.startsWith("image/gif")) return "gif";
  if (m.startsWith("image/heic")) return "heic";
  if (m.startsWith("image/")) return "img";
  if (m.startsWith("application/pdf")) return "pdf";
  return "bin";
}

/** מסיר תווים שעלולים לשבור שם קובץ במערכות קבצים. */
function sanitizeDownloadFileName(name: string): string {
  const t = name.replace(/[/\\:*?"<>|\u0000-\u001F]/g, "_").trim();
  return t.length > 0 ? t : "document";
}

/** הדפסת תמונה מ־blob URL בחלון ייעודי (לא כל הממשק במודאל). */
function printImageObjectUrl(src: string) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.write(
    `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><title></title>` +
      `<style>@page{margin:10mm}body{margin:0;display:flex;justify-content:center;align-items:flex-start}` +
      `img{max-width:100%;height:auto}</style></head><body>` +
      `<img src="${src}" alt="" onload="window.focus();window.print();"/>` +
      `</body></html>`,
  );
  w.document.close();
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
  /** שם קובץ מוצע להורדה (למשל receipt.pdf). אם חסר — נבנה מ־viewerKey וסיומת לפי MIME. */
  downloadFileName?: string;
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
  downloadFileName,
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
  const pdfIframeRef = useRef<HTMLIFrameElement>(null);
  const fetchRef = useRef(fetchFile);
  fetchRef.current = fetchFile;
  const preferExternalPdf = usePreferOpeningPdfExternally();
  const [phase, setPhase] = useState<ViewerPhase>({ kind: "loading" });

  const handleSaveLocal = useCallback(() => {
    if (phase.kind !== "ready") return;
    const ext = extensionForMime(phase.effectiveMime);
    const rawName =
      downloadFileName?.trim() ||
      `document-${viewerKey}.${ext}`;
    const name = sanitizeDownloadFileName(rawName);
    const a = document.createElement("a");
    a.href = phase.objectUrl;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [downloadFileName, phase, viewerKey]);

  const handlePrint = useCallback(() => {
    if (phase.kind !== "ready") return;
    const { objectUrl, isImage, effectiveMime } = phase;

    if (isImage) {
      printImageObjectUrl(objectUrl);
      return;
    }

    if (isPdfMime(effectiveMime)) {
      const frame = pdfIframeRef.current;
      const cw = frame?.contentWindow;
      if (cw && frame?.src && frame.src.startsWith("blob:")) {
        try {
          cw.focus();
          cw.print();
          return;
        } catch {
          /* fallback */
        }
      }
      const w = window.open(objectUrl, "_blank", "noopener,noreferrer");
      w?.focus();
      return;
    }

    const w = window.open(objectUrl, "_blank", "noopener,noreferrer");
    w?.focus();
  }, [phase]);

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
        className={appModalBackdropClass}
        aria-label="סגירת תצוגת הקובץ"
        onClick={onClose}
      />
      <div
        dir="rtl"
        className="relative z-10 flex h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.65rem] border border-teal-100/95 bg-white/95 shadow-[0_-16px_46px_-16px_rgb(13_148_136_/_0.28)] backdrop-blur-sm sm:my-4 sm:h-[min(90dvh,920px)] sm:rounded-2xl sm:shadow-[0_24px_60px_-28px_rgb(13_148_136_/_0.32)]"
      >
        <div
          className={`${appModalHeaderClass} flex shrink-0 flex-wrap items-center justify-between gap-3 py-2.5`}
        >
          <h2 id="doc-file-viewer-title" className="text-sm font-semibold text-teal-950">
            תצוגת המסמך
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {phase.kind === "ready" ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveLocal}
                  className="shrink-0 rounded-xl border border-teal-200/90 bg-white px-3 py-1.5 text-sm font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
                >
                  הורדה
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="shrink-0 rounded-xl border border-teal-200/90 bg-white px-3 py-1.5 text-sm font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
                >
                  הדפסה
                </button>
              </>
            ) : null}
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-teal-200/90 bg-white px-3 py-1.5 text-sm font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
            >
              סגירה
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 bg-gradient-to-b from-teal-50/50 to-zinc-50/95">
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
                className={`mx-auto ${appModalGhostButtonClass}`}
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
              ref={pdfIframeRef}
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
