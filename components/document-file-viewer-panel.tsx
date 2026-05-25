"use client";

import { useEffect, useRef, useState } from "react";

function isPdfMime(mime: string): boolean {
  return mime.trim().toLowerCase().startsWith("application/pdf");
}

/** טוען קובץ ומחזיר blob URL + mime אפקטיבי. */
async function loadIntoObjectUrl(
  fetchFile: () => Promise<Response>,
): Promise<{ objectUrl: string; viewerMime: string }> {
  const res = await fetchFile();
  const headerMime =
    res.headers.get("Content-Type")?.split(";")[0]?.trim() ?? "";
  if (!res.ok) {
    let msg = `שגיאה ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const viewerMime = (blob.type || headerMime).trim();
  return { objectUrl: URL.createObjectURL(blob), viewerMime };
}

export type DocumentFileViewerPanelProps = {
  /** מזהה לשכבת טעינה מחדש כשמחליפים מסמך */
  viewerKey: string;
  mimeTypeHint: string;
  /** טעינת תגובת הקובץ (כולל credentials) */
  fetchFile: () => Promise<Response>;
  className?: string;
};

/**
 * נגן מסמך מוטבע (ללא overlay / backdrop).
 * PDFים מוצגים ב-<iframe> עם blob URL (נגן המובנה של הדפדפן).
 * תמונות מוצגות ב-<img>.
 */
export function DocumentFileViewerPanel({
  viewerKey,
  mimeTypeHint,
  fetchFile,
  className = "",
}: DocumentFileViewerPanelProps) {
  type Phase =
    | { kind: "loading" }
    | { kind: "ready"; objectUrl: string; isImage: boolean; mime: string }
    | { kind: "error"; message: string };

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const fetchRef = useRef(fetchFile);
  fetchRef.current = fetchFile;

  useEffect(() => {
    setPhase({ kind: "loading" });
    let cancelled = false;
    let url: string | null = null;

    void (async () => {
      try {
        const loaded = await loadIntoObjectUrl(() => fetchRef.current());
        const effective =
          (loaded.viewerMime || mimeTypeHint).trim().toLowerCase();
        url = loaded.objectUrl;
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPhase({
          kind: "ready",
          objectUrl: url,
          isImage: effective.startsWith("image/"),
          mime: effective,
        });
      } catch (e) {
        if (cancelled) return;
        setPhase({
          kind: "error",
          message:
            e instanceof Error ? e.message : "לא ניתן לטעון את הקובץ.",
        });
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mimeTypeHint, viewerKey]);

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-100/80 ${className}`}
    >
      {phase.kind === "loading" ? (
        <div className="flex size-full items-center justify-center p-6 text-sm text-zinc-500">
          טוענים את הקובץ…
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm text-red-600" role="alert">
            {phase.message}
          </p>
        </div>
      ) : null}

      {phase.kind === "ready" && phase.isImage ? (
        <div className="size-full overflow-auto p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={phase.objectUrl}
            alt=""
            className="mx-auto block max-h-full max-w-full object-contain"
          />
        </div>
      ) : null}

      {phase.kind === "ready" && !phase.isImage && isPdfMime(phase.mime) ? (
        <iframe
          title="תוכן המסמך"
          src={phase.objectUrl}
          className="absolute inset-0 size-full bg-white"
        />
      ) : null}

      {phase.kind === "ready" && !phase.isImage && !isPdfMime(phase.mime) ? (
        <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-zinc-600">
            לא ניתן להציג קובץ מסוג זה ישירות.
          </p>
          <a
            href={phase.objectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50"
          >
            פתיחה בלשונית חדשה
          </a>
        </div>
      ) : null}
    </div>
  );
}
