import { hash as bcryptHash } from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { ensureInvitationSchema } from "@/lib/db/ensure-invitation-schema";
import {
  accountantHasAnotherClientWithSameDisplayName,
  clientHasMemberFingerprintCollision,
  newBatchInvitesContainDuplicateFingerprints,
  memberInviteDisplayFingerprint,
} from "@/lib/accountant/display-uniqueness";
import {
  auditEvents,
  clientMembers,
  clients,
  invitations,
  userRoles,
  users,
} from "@/lib/db/schema";
import type { AppRole } from "@/lib/auth/roles";
import { APP_ROLES, defaultHomePath } from "@/lib/auth/roles";
import {
  generateInvitationRawToken,
  hashInvitationToken,
} from "@/lib/invitations/token";

const INVITE_TTL_DAYS = 7;

function isAppRole(r: string): r is AppRole {
  return (APP_ROLES as readonly string[]).includes(r);
}

function redirectForInvitationRole(role: AppRole): string {
  return defaultHomePath([role]);
}

export async function lookupInvitationByRawToken(rawToken: string) {
  await ensureInvitationSchema(pool);
  const tokenHash = hashInvitationToken(rawToken);
  const [row] = await db
    .select({
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      consumedAt: invitations.consumedAt,
      clientDisplayName: clients.displayName,
    })
    .from(invitations)
    .leftJoin(clients, eq(invitations.clientId, clients.id))
    .where(
      and(eq(invitations.tokenHash, tokenHash), isNull(invitations.consumedAt)),
    )
    .limit(1);

  if (!row) {
    return { ok: false as const, reason: "not_found" as const };
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }
  if (!isAppRole(row.role) || row.role === "admin") {
    return { ok: false as const, reason: "not_found" as const };
  }

  return {
    ok: true as const,
    data: {
      email: row.email,
      role: row.role,
      expiresAt: row.expiresAt.toISOString(),
      clientDisplayName: row.clientDisplayName ?? null,
    },
  };
}

export type AcceptInvitationInput = {
  rawToken: string;
  password: string;
  locale: string;
};

export async function acceptInvitation(input: AcceptInvitationInput) {
  await ensureInvitationSchema(pool);
  const tokenHash = hashInvitationToken(input.rawToken);
  const locale = input.locale === "en" ? "en" : "he";

  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.tokenHash, tokenHash),
          isNull(invitations.consumedAt),
        ),
      )
      .limit(1);

    if (!inv) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (inv.expiresAt.getTime() <= Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }
    if (!isAppRole(inv.role) || inv.role === "admin") {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (inv.role === "client" && !inv.clientId) {
      return { ok: false as const, reason: "invalid_invitation" as const };
    }
    if (inv.role === "accountant" && inv.clientId) {
      return { ok: false as const, reason: "invalid_invitation" as const };
    }

    const email = inv.email.trim().toLowerCase();
    const [existingUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser) {
      return { ok: false as const, reason: "email_taken" as const };
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcryptHash(input.password, 12);
    const displayName =
      inv.inviteeDisplayName?.trim() ||
      email.split("@")[0] ||
      email;

    await tx.insert(users).values({
      id: userId,
      email,
      name: displayName,
      passwordHash,
      locale,
      emailVerified: new Date(),
    });

    await tx.insert(userRoles).values({
      userId,
      role: inv.role,
    });

    if (inv.role === "client" && inv.clientId) {
      const memberRole =
        inv.clientMemberRole === "primary" ? "primary" : "member";
      await tx.insert(clientMembers).values({
        clientId: inv.clientId,
        userId,
        memberRole,
      });
      await tx
        .update(clients)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(clients.id, inv.clientId));
    }

    const consumed = await tx
      .update(invitations)
      .set({ consumedAt: new Date() })
      .where(
        and(eq(invitations.id, inv.id), isNull(invitations.consumedAt)),
      )
      .returning({ id: invitations.id });

    if (consumed.length === 0) {
      throw new Error("invitation_consume_race");
    }

    await tx.insert(auditEvents).values({
      id: crypto.randomUUID(),
      actorUserId: null,
      action: "invitation_accepted",
      entityType: "user",
      entityId: userId,
      payloadJson: { invitationId: inv.id, role: inv.role },
    });

    return {
      ok: true as const,
      userId,
      role: inv.role,
      redirectTo: redirectForInvitationRole(inv.role),
    };
  });
}

export type CreateAccountantInvitationInput = {
  email: string;
  inviteeDisplayName?: string | null;
  createdByUserId: string;
};

export async function createAccountantInvitation(
  input: CreateAccountantInvitationInput,
) {
  await ensureInvitationSchema(pool);
  const email = input.email.trim().toLowerCase();
  const rawToken = generateInvitationRawToken();
  const tokenHash = hashInvitationToken(rawToken);
  const id = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return { ok: false as const, reason: "email_taken" as const };
  }

  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        eq(invitations.role, "accountant"),
        isNull(invitations.consumedAt),
      ),
    )
    .limit(1);
  if (pending) {
    return { ok: false as const, reason: "pending_invitation" as const };
  }

  await db.insert(invitations).values({
    id,
    email,
    role: "accountant",
    tokenHash,
    expiresAt,
    createdByUserId: input.createdByUserId,
    inviteeDisplayName: input.inviteeDisplayName?.trim() || null,
    clientId: null,
  });

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorUserId: input.createdByUserId,
    action: "accountant_invitation_created",
    entityType: "invitation",
    entityId: id,
    payloadJson: { email },
  });

  return {
    ok: true as const,
    invitationId: id,
    email,
    expiresAt: expiresAt.toISOString(),
    rawToken,
  };
}

export type CreateClientWithInvitationInput = {
  accountantUserId: string;
  displayName: string;
  inviteEmail: string;
  inviteeDisplayName?: string | null;
  memberRole: "primary" | "member";
};

/**
 * טרנזקציה: יצירת לקוח + הזמנת החבר הראשון (תאימות מול קוד קיים).
 */
export async function createClientWithInvitation(
  input: CreateClientWithInvitationInput,
) {
  const batch = await createClientWithInvitations({
    accountantUserId: input.accountantUserId,
    clientDisplayName: input.displayName,
    invitations: [
      {
        email: input.inviteEmail,
        inviteeDisplayName: input.inviteeDisplayName ?? null,
        memberRole:
          input.memberRole === "primary"
            ? ("primary" as const)
            : ("member" as const),
      },
    ],
  });

  if (!batch.ok) {
    return batch;
  }
  const head = batch.invites[0];
  if (!head) {
    return { ok: false as const, reason: "transaction_failed" as const };
  }
  return {
    ok: true as const,
    client: batch.client,
    invitationId: head.invitationId,
    expiresAt: head.expiresAt,
    rawToken: head.rawToken,
  };
}

export type ClientInvitationRowInput = {
  email: string;
  inviteeDisplayName?: string | null;
  memberRole?: "primary" | "member";
};

/**
 * נקודות כניסה לאימות מייל לפני יצירת הזמנת לקוח חדשה.
 */
export async function validateNewClientInvitationEmail(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return { ok: false as const, reason: "email_taken" as const, email };
  }

  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        eq(invitations.role, "client"),
        isNull(invitations.consumedAt),
      ),
    )
    .limit(1);
  if (pending) {
    return { ok: false as const, reason: "pending_invitation" as const, email };
  }

  return { ok: true as const, email };
}

/**
 * טרנזקציה: יצירת לקוח + עד ארבע הזמנות לחברים (כל המיילים ייחודיים).
 */
export async function createClientWithInvitations(input: {
  accountantUserId: string;
  clientDisplayName: string;
  invitations: ClientInvitationRowInput[];
}) {
  await ensureInvitationSchema(pool);
  const displayName = input.clientDisplayName.trim();
  const rows = input.invitations;

  if (rows.length < 1 || rows.length > 4) {
    return { ok: false as const, reason: "invite_count" as const };
  }

  const seen = new Set<string>();
  for (const row of rows) {
    const e = row.email.trim().toLowerCase();
    if (seen.has(e)) {
      return { ok: false as const, reason: "duplicate_emails_in_request" as const };
    }
    seen.add(e);
  }

  for (const r of rows) {
    const v = await validateNewClientInvitationEmail(r.email);
    if (!v.ok) {
      return { ok: false as const, reason: v.reason, email: v.email };
    }
  }

  const resolvedRows = rows.map((r, i) => ({
    email: r.email.trim().toLowerCase(),
    inviteeDisplayName: r.inviteeDisplayName?.trim() || null,
    memberRole:
      r.memberRole ?? (i === 0 ? ("primary" as const) : ("member" as const)),
  }));

  const takenByAccountant =
    await accountantHasAnotherClientWithSameDisplayName({
      accountantUserId: input.accountantUserId,
      displayName: displayName,
    });
  if (takenByAccountant) {
    return {
      ok: false as const,
      reason: "duplicate_client_display_name" as const,
    };
  }

  if (
    newBatchInvitesContainDuplicateFingerprints(
      resolvedRows.map((r) => ({
        email: r.email,
        inviteeDisplayName: r.inviteeDisplayName,
      })),
    )
  ) {
    return {
      ok: false as const,
      reason: "duplicate_member_display_name_batch" as const,
    };
  }

  const clientId = crypto.randomUUID();

  try {
    return await db.transaction(async (tx) => {
      const firstEmail = resolvedRows[0]?.email;

      await tx.insert(clients).values({
        id: clientId,
        accountantId: input.accountantUserId,
        displayName,
        status: "pending_invite",
        invitedEmail: firstEmail ?? null,
        updatedAt: new Date(),
      });

      const outInvites: {
        invitationId: string;
        email: string;
        expiresAt: string;
        rawToken: string;
      }[] = [];

      for (const rw of resolvedRows) {
        const rawToken = generateInvitationRawToken();
        const tokenHash = hashInvitationToken(rawToken);
        const invId = crypto.randomUUID();
        const expiresAt = new Date(
          Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        await tx.insert(invitations).values({
          id: invId,
          email: rw.email,
          role: "client",
          tokenHash,
          expiresAt,
          createdByUserId: input.accountantUserId,
          inviteeDisplayName: rw.inviteeDisplayName,
          clientId,
          clientMemberRole: rw.memberRole === "primary" ? "primary" : "member",
        });

        outInvites.push({
          invitationId: invId,
          email: rw.email,
          expiresAt: expiresAt.toISOString(),
          rawToken,
        });
      }

      await tx.insert(auditEvents).values({
        id: crypto.randomUUID(),
        actorUserId: input.accountantUserId,
        action: "client_created_with_invitation",
        entityType: "client",
        entityId: clientId,
        payloadJson: {
          invitationIds: outInvites.map((o) => o.invitationId),
          emails: resolvedRows.map((r) => r.email),
          count: resolvedRows.length,
        },
      });

      return {
        ok: true as const,
        client: {
          id: clientId,
          displayName,
          status: "pending_invite" as const,
        },
        invites: outInvites,
      };
    });
  } catch {
    return { ok: false as const, reason: "transaction_failed" as const };
  }
}

export type InviteClientMemberInput = {
  accountantUserId: string;
  clientId: string;
  email: string;
  inviteeDisplayName?: string | null;
  memberRole: "primary" | "member";
};

/**
 * הזמנת משתמש נוסף ללקוח קיים (רק אם clients.accountantId תואם).
 */
export async function inviteAdditionalClientMember(
  input: InviteClientMemberInput,
) {
  await ensureInvitationSchema(pool);
  const email = input.email.trim().toLowerCase();
  const rawToken = generateInvitationRawToken();
  const tokenHash = hashInvitationToken(rawToken);
  const invId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const clientMemberRole = input.memberRole === "primary" ? "primary" : "member";

  const [clientRow] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  if (!clientRow || clientRow.accountantId !== input.accountantUserId) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return { ok: false as const, reason: "email_taken" as const };
  }

  const [pendingAny] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        eq(invitations.role, "client"),
        isNull(invitations.consumedAt),
      ),
    )
    .limit(1);
  if (pendingAny) {
    return { ok: false as const, reason: "pending_invitation" as const };
  }

  const newFp = memberInviteDisplayFingerprint(
    input.inviteeDisplayName ?? null,
    email,
  );
  const collides = await clientHasMemberFingerprintCollision({
    clientId: input.clientId,
    fingerprint: newFp,
  });
  if (collides) {
    return {
      ok: false as const,
      reason: "duplicate_member_display_name" as const,
    };
  }

  await db.insert(invitations).values({
    id: invId,
    email,
    role: "client",
    tokenHash,
    expiresAt,
    createdByUserId: input.accountantUserId,
    inviteeDisplayName: input.inviteeDisplayName?.trim() || null,
    clientId: input.clientId,
    clientMemberRole,
  });

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    actorUserId: input.accountantUserId,
    action: "client_member_invited",
    entityType: "invitation",
    entityId: invId,
    payloadJson: { clientId: input.clientId, email },
  });

  return {
    ok: true as const,
    invitationId: invId,
    email,
    expiresAt: expiresAt.toISOString(),
    rawToken,
  };
}
