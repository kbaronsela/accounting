import "server-only";

/**
 * טקסט קצר מסודר ללוג / פרטי תגובה — בלי הרחבות שלא נועדו למשתמש.
 */
export function safeS3UpstreamSummary(e: unknown, maxLen = 280): string | undefined {
  if (e == null || typeof e !== "object") {
    const msg =
      typeof e === "string"
        ? e
        : e instanceof Error && typeof e.message === "string"
          ? e.message
          : undefined;
    const s = typeof msg === "string" ? msg.trim().replace(/\s+/g, " ") : "";
    return s.length > 0 ? s.slice(0, maxLen) : undefined;
  }

  const any = e as { message?: unknown; Code?: unknown; name?: unknown };
  const parts: string[] = [];
  if (typeof any.Code === "string" && any.Code.trim().length > 0) {
    parts.push(any.Code.trim());
  }
  if (typeof any.name === "string" && any.name.trim().length > 0) {
    parts.push(any.name.trim());
  }
  if (typeof any.message === "string" && any.message.trim().length > 0) {
    parts.push(any.message.trim().replace(/\s+/g, " "));
  }
  if (!parts.length) return undefined;

  let out = parts.join(" · ");
  if (out.length > maxLen) out = `${out.slice(0, Math.max(0, maxLen - 1))}…`;
  return out;
}
