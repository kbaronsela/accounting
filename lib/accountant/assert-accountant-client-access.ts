import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

export async function getClientOwnedByAccountant(
  accountantUserId: string,
  clientId: string,
) {
  const [row] = await db
    .select({
      id: clients.id,
      displayName: clients.displayName,
      status: clients.status,
      accountantId: clients.accountantId,
    })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.accountantId, accountantUserId),
      ),
    )
    .limit(1);
  if (!row) {
    return null;
  }
  return row;
}
