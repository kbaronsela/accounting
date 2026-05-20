import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { ensureUserRoleTable } from "@/lib/db/ensure-user-role-schema";
import { userRoles, users } from "@/lib/db/schema";

/** נקרא רק ב-API Route / callbacks ב-Node — לא ב-Edge */
export async function loadUserRolesAndLocale(userId: string) {
  await ensureUserRoleTable(pool);

  const [row] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const roleRows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  return {
    roles: roleRows.map((r) => r.role),
    locale: row?.locale ?? "he",
  };
}
