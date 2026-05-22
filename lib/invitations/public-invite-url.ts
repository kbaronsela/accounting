import { getAuthPublicBaseUrl } from "@/lib/env/auth-public-base-url";

const inviteHost = getAuthPublicBaseUrl();

export function getPublicInviteUrl(rawToken: string): string {
  const u = new URL("/invite", inviteHost);
  u.searchParams.set("token", rawToken);
  return u.toString();
}

/** מקור ציבורי של האפליקציה (למשל קישורי העלאה חתומים-מקומית). */
export function getPublicAppOrigin(): string {
  return inviteHost;
}
