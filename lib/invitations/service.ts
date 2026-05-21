import { hash as bcryptHash } from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { ensureInvitationSchema } from "@/lib/db/ensure-invitation-schema";
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
 * טרנזקציה: יצירת תיק לקוח + הזמנת חבר ראשון (role: client).
 */
export async function createClientWithInvitation(
  input: CreateClientWithInvitationInput,
) {
  await ensureInvitationSchema(pool);
  const email = input.inviteEmail.trim().toLowerCase();
  const rawToken = generateInvitationRawToken();
  const tokenHash = hashInvitationToken(rawToken);
  const clientId = crypto.randomUUID();
  const invId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const clientMemberRole = input.memberRole === "primary" ? "primary" : "member";
  const displayName = input.displayName.trim();

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
        eq(invitations.role, "client"),
        isNull(invitations.consumedAt),
      ),
    )
    .limit(1);
  if (pending) {
    return { ok: false as const, reason: "pending_invitation" as const };
  }

  return db.transaction(async (tx) => {
    await tx.insert(clients).values({
      id: clientId,
      accountantId: input.accountantUserId,
      displayName,
      status: "pending_invite",
      invitedEmail: email,
      updatedAt: new Date(),
    });

    await tx.insert(invitations).values({
      id: invId,
      email,
      role: "client",
      tokenHash,
      expiresAt,
      createdByUserId: input.accountantUserId,
      inviteeDisplayName: input.inviteeDisplayName?.trim() || null,
      clientId,
      clientMemberRole,
    });

    await tx.insert(auditEvents).values({
      id: crypto.randomUUID(),
      actorUserId: input.accountantUserId,
      action: "client_created_with_invitation",
      entityType: "client",
      entityId: clientId,
      payloadJson: { invitationId: invId, email },
    });

    return {
      ok: true as const,
      client: {
        id: clientId,
        displayName,
        status: "pending_invite" as const,
      },
      invitationId: invId,
      expiresAt: expiresAt.toISOString(),
      rawToken,
    };
  });
}

export type InviteClientMemberInput = {
  accountantUserId: string;
  clientId: string;
  email: string;
  inviteeDisplayName?: string | null;
  memberRole: "primary" | "member";
};

/**
 * הזמנת משתמש נוסף לתיק לקוח קיים (רק אם clients.accountantId תואם).
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
