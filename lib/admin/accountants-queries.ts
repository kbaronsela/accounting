import "server-only";

import type { AccountantListItem } from "@/lib/admin/accountants-types";
import { db } from "@/lib/db";
import { clients, userRoles, users } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

export async function listAccountantsWithClientCounts(): Promise<
  AccountantListItem[]
> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(eq(userRoles.role, "accountant"));

  const ids = rows.map((r) => r.id);

  let countMap = new Map<string, number>();
  if (ids.length > 0) {
    const groups = await db
      .select({
        accountantId: clients.accountantId,
        n: sql<number>`count(*)::int`,
      })
      .from(clients)
      .where(inArray(clients.accountantId, ids))
      .groupBy(clients.accountantId);
    countMap = new Map(groups.map((g) => [g.accountantId, Number(g.n)]));
  }

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    createdAt: r.createdAt?.toISOString() ?? null,
    clientCount: countMap.get(r.id) ?? 0,
  }));
}
