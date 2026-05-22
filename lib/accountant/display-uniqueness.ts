import { db } from "@/lib/db";
import { clientMembers, clients, invitations, users } from "@/lib/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * מפתח עקיף למניעת שני משתמשים/הזמנות מאותה תצוגת שם (שם מתנה אחרת מקדימון אימייל).
 */
export function memberInviteDisplayFingerprint(
  inviteeOrUserDisplayName: string | null | undefined,
  email: string,
): string {
  const em = email.trim().toLowerCase();
  const n = inviteeOrUserDisplayName?.trim() ?? "";
  const label =
    n.length > 0 ? n : ((em.includes("@") ? em.split("@")[0] : em) ?? em);
  return label.trim().toLowerCase();
}

export function accountantClientDisplayFingerprint(displayNameTrimmed: string): string {
  return displayNameTrimmed.trim().toLowerCase();
}

export async function accountantHasAnotherClientWithSameDisplayName(params: {
  accountantUserId: string;
  displayName: string;
  excludeClientId?: string | null;
}): Promise<boolean> {
  const fp = accountantClientDisplayFingerprint(params.displayName);
  const clauses = [
    eq(clients.accountantId, params.accountantUserId),
    sql`lower(trim(${clients.displayName})) = ${fp}`,
  ];
  if (params.excludeClientId) {
    clauses.push(ne(clients.id, params.excludeClientId));
  }
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(...clauses))
    .limit(1);
  return row !== undefined;
}

export async function clientHasMemberFingerprintCollision(params: {
  clientId: string;
  fingerprint: string;
  excludeUserId?: string | null;
  excludeInvitationId?: string | null;
}): Promise<boolean> {
  const memberRows = await db
    .select({
      userId: clientMembers.userId,
      email: users.email,
      name: users.name,
    })
    .from(clientMembers)
    .innerJoin(users, eq(clientMembers.userId, users.id))
    .where(eq(clientMembers.clientId, params.clientId));

  const pendingInvites = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      inviteeDisplayName: invitations.inviteeDisplayName,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.clientId, params.clientId),
        isNull(invitations.consumedAt),
        eq(invitations.role, "client"),
      ),
    );

  for (const m of memberRows) {
    if (
      params.excludeUserId !== undefined &&
      params.excludeUserId !== null &&
      m.userId === params.excludeUserId
    ) {
      continue;
    }
    const em = (m.email ?? "").trim().toLowerCase();
    const fp = memberInviteDisplayFingerprint(m.name, em);
    if (fp === params.fingerprint) return true;
  }

  for (const inv of pendingInvites) {
    if (
      params.excludeInvitationId !== undefined &&
      params.excludeInvitationId !== null &&
      inv.id === params.excludeInvitationId
    ) {
      continue;
    }
    const fp = memberInviteDisplayFingerprint(
      inv.inviteeDisplayName ?? null,
      inv.email.trim().toLowerCase(),
    );
    if (fp === params.fingerprint) return true;
  }

  return false;
}

/** כפילות בין מוזמנים באותה בקשה (למשל שניים עם אותו שם מת לפני מייל). */
export function newBatchInvitesContainDuplicateFingerprints(rows: Array<{
  email: string;
  inviteeDisplayName?: string | null;
}>): boolean {
  const fingerprints = rows.map((r) =>
    memberInviteDisplayFingerprint(
      r.inviteeDisplayName ?? null,
      r.email.trim().toLowerCase(),
    ),
  );
  return new Set(fingerprints).size !== fingerprints.length;
}
