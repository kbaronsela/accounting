import { z } from "zod";

const inviteHost = z
  .string()
  .min(1)
  .parse(
    process.env.AUTH_URL ??
      process.env.NEXTAUTH_URL ??
      "http://localhost:3000",
  )
  .replace(/\/$/, "");

export function getPublicInviteUrl(rawToken: string): string {
  const u = new URL("/invite", inviteHost);
  u.searchParams.set("token", rawToken);
  return u.toString();
}

/** מקור ציבורי של האפליקציה (למשל קישורי העלאה חתומים-מקומית). */
export function getPublicAppOrigin(): string {
  return inviteHost;
}
