/** תפקידי מערכת (מחרוזות ייחודיות ב־DB) */
export const APP_ROLES = ["admin", "accountant", "client"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function hasRole(
  roles: string[] | undefined | null,
  role: AppRole,
): boolean {
  return roles?.includes(role) ?? false;
}

/** סדר התחלה אחרי התחברות — ראשון שמותאם */
export function defaultHomePath(roles: string[] | undefined | null): string {
  if (hasRole(roles, "admin")) return "/admin";
  if (hasRole(roles, "accountant")) return "/accountant";
  if (hasRole(roles, "client")) return "/client";
  return "/";
}
