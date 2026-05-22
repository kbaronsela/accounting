/**
 * כתובת בסיס ציבורית ל־Auth.js וקישורי הזמנה חיצוניים.
 *
 * ברילווייה/פריסות אחרות לפעמים משימים משתנה כמו רק hostname (ללא `https://`).
 * צריך URL מוחלט — אחרת `new URL()` במסלולים של Auth זורק Invalid URL.
 */
export function getAuthPublicBaseUrl(): string {
  const raw = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL)?.trim();
  const base =
    raw && raw.length > 0 ? raw : ("http://localhost:3000" as const);
  const withScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  return withScheme.replace(/\/$/, "");
}

/**
 * מעדכן `process.env` כדי שספריות (למשל next-auth) יראו URL תקף.
 */
export function syncAuthPublicBaseUrlIntoProcessEnv(): void {
  const raw = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL)?.trim();
  if (!raw) return;
  const canon = getAuthPublicBaseUrl();
  process.env.AUTH_URL = canon;
  process.env.NEXTAUTH_URL = canon;
}
