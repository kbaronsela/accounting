import { db } from "@/lib/db";
import { clientMembers, clients, documents, users } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

export type ClientMeUser = {
  id: string;
  email: string | null;
  name: string | null;
  locale: string | null;
};

export type ClientMeClientRow = {
  id: string;
  displayName: string;
  role: "primary" | "member";
};

export async function getClientMe(
  userId: string,
): Promise<{ user: ClientMeUser; clients: ClientMeClientRow[] } | null> {
  const [userRow] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      locale: users.locale,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    return null;
  }

  const clientRows = await db
    .select({
      id: clients.id,
      displayName: clients.displayName,
      memberRole: clientMembers.memberRole,
    })
    .from(clientMembers)
    .innerJoin(clients, eq(clientMembers.clientId, clients.id))
    .where(eq(clientMembers.userId, userId));

  return {
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      locale: userRow.locale,
    },
    clients: clientRows.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      role: c.memberRole === "primary" ? "primary" : "member",
    })),
  };
}

export type ClientDocumentListItem = {
  id: string;
  clientId: string;
  clientDisplayName: string;
  status: string;
  finalAmount: string | null;
  finalCurrency: string | null;
  finalDate: string | null;
  finalVendor: string | null;
  clientNote: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function listDocumentsForClientUser(
  userId: string,
  options: {
    clientId?: string | null;
    status?: string | null;
    limit?: number;
  } = {},
): Promise<
  | { ok: true; items: ClientDocumentListItem[] }
  | { ok: false; reason: "forbidden_client" | "invalid_client_id" }
> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  const memberships = await db
    .select({ clientId: clientMembers.clientId })
    .from(clientMembers)
    .where(eq(clientMembers.userId, userId));

  const allowedIds = [...new Set(memberships.map((m) => m.clientId))];
  if (allowedIds.length === 0) {
    return { ok: true, items: [] };
  }

  let filterIds = allowedIds;
  if (options.clientId) {
    if (!isUuid(options.clientId)) {
      return { ok: false, reason: "invalid_client_id" };
    }
    if (!allowedIds.includes(options.clientId)) {
      return { ok: false, reason: "forbidden_client" };
    }
    filterIds = [options.clientId];
  }

  const conditions = [inArray(documents.clientId, filterIds)];
  if (options.status && options.status.length > 0) {
    conditions.push(eq(documents.status, options.status));
  }

  const rows = await db
    .select({
      id: documents.id,
      clientId: documents.clientId,
      clientDisplayName: clients.displayName,
      status: documents.status,
      finalAmount: documents.finalAmount,
      finalCurrency: documents.finalCurrency,
      finalDate: documents.finalDate,
      finalVendor: documents.finalVendor,
      clientNote: documents.clientNote,
      submittedAt: documents.submittedAt,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(documents.updatedAt))
    .limit(limit);

  return {
    ok: true,
    items: rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientDisplayName: r.clientDisplayName,
      status: r.status,
      finalAmount: r.finalAmount,
      finalCurrency: r.finalCurrency,
      finalDate: r.finalDate,
      finalVendor: r.finalVendor,
      clientNote: r.clientNote,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}
