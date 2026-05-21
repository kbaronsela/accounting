import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { ensureUserRoleTable } from "@/lib/db/ensure-user-role-schema";
import { userRoles, users } from "@/lib/db/schema";

/**
 * OAuth (גוגל/פייסבוק) — רק אם כבר קיימים משתמש ותפקיד באפליקציה באותו אימייל
 * (הזמנה/אדמין bootstrap); אחרת signIn צריך להיכשל.
 */
export async function userHasOAuthAppAccess(email: string): Promise<boolean> {
  await ensureUserRoleTable(pool);
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (!user) return false;

  const [roleRow] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id))
    .limit(1);

  return Boolean(roleRow);
}
