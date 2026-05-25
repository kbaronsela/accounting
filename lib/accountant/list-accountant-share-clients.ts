import "server-only";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** לחלון השלמת שיתוף (רו״ח) — רשימת תיקים בבעלותו */
export async function listAccountantsClientsOwnedForShare(
  accountantUserId: string,
): Promise<Array<{ id: string; displayName: string }>> {
  return db
    .select({
      id: clients.id,
      displayName: clients.displayName,
    })
    .from(clients)
    .where(eq(clients.accountantId, accountantUserId));
}
