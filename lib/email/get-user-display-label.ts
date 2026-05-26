import "server-only";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** שם לתצוגה במייל (נושא/גוף) — מתוך פרופיל או מתוך התחלה של האימייל */
export async function getUserDisplayLabelForEmail(
  userId: string,
): Promise<string> {
  const [u] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const n = u?.name?.trim();
  if (n) return n;

  const em = u?.email?.trim();
  if (em) {
    const local = em.split("@")[0];
    if (local && local.length > 0) return local;
    return em;
  }

  return "רואה החשבון";
}
