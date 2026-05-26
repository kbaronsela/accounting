import { getAuthPublicBaseUrl } from "@/lib/env/auth-public-base-url";

function isLoopbackOrigin(base: string): boolean {
  try {
    const u = new URL(base);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

/**
 * מקור URL מכותרות reverse proxy (Railway, Vercel וכו').
 * ללא host אמיתי — null.
 */
export function inferPublicOriginFromProxyHeaders(headers: Headers): string | null {
  const rawHost = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  const host = rawHost.split(",")[0]?.trim() ?? "";
  if (!host) return null;

  const rawProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "";

  const maybeHostOnly = host.includes(":") ? host.split(":")[0] : host;
  const isLocal =
    maybeHostOnly === "localhost" ||
    maybeHostOnly === "127.0.0.1" ||
    maybeHostOnly.endsWith(".local");

  const proto =
    rawProto === "http" || rawProto === "https"
      ? rawProto
      : isLocal
        ? "http"
        : "https";

  return `${proto}://${host}`.replace(/\/$/, "");
}

/**
 * בסיס ציבורי למניפסט PWA (`start_url`, `id`, `scope`). חייב להתאים לדומיין שהמשתמש פותח בדפדפן.
 *
 * בפרודקשן: אם `AUTH_URL` בטעות localhost — לא משתמשים בו; מעדיפים את הכתובת מהבקשה.
 */
export function getWebAppManifestPublicBase(headers: Headers): string {
  const fromRequest = inferPublicOriginFromProxyHeaders(headers);
  const fromEnv = getAuthPublicBaseUrl();

  if (process.env.NODE_ENV === "production") {
    if (fromRequest && !isLoopbackOrigin(fromRequest)) {
      return fromRequest;
    }
    if (!isLoopbackOrigin(fromEnv)) {
      return fromEnv;
    }
    if (fromRequest) {
      return fromRequest;
    }
    return fromEnv;
  }

  return fromRequest ?? fromEnv;
}
