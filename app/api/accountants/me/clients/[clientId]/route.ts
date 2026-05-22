import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { deleteClientOwnedByAccountant } from "@/lib/accountant/delete-client-owned-by-accountant";
import { accountantHasAnotherClientWithSameDisplayName } from "@/lib/accountant/display-uniqueness";
import { getClientOwnedByAccountant } from "@/lib/accountant/assert-accountant-client-access";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import {
  auditEvents,
  clientMembers,
  clients,
  invitations,
  users,
} from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

type RouteContext = { params: Promise<{ clientId: string }> };

const patchBodySchema = z.object({
  displayName: z.string().min(1).max(300),
});

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId } = await context.params;
  if (!z.string().uuid().safeParse(clientId).success) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה לקוח לא תקין.");
  }

  const owned = await getClientOwnedByAccountant(session.user.id, clientId);
  if (!owned) {
    return jsonError(404, "NOT_FOUND", "הלקוח לא נמצא או שאין הרשאה.");
  }

  const memberRows = await db
    .select({
      userId: clientMembers.userId,
      email: users.email,
      displayName: users.name,
      memberRole: clientMembers.memberRole,
    })
    .from(clientMembers)
    .innerJoin(users, eq(clientMembers.userId, users.id))
    .where(eq(clientMembers.clientId, clientId));

  const pendingRows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      inviteeDisplayName: invitations.inviteeDisplayName,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.clientId, clientId),
        isNull(invitations.consumedAt),
        eq(invitations.role, "client"),
      ),
    );

  return Response.json({
    client: {
      id: owned.id,
      displayName: owned.displayName,
      status: owned.status,
    },
    members: memberRows.map((m) => {
      const displayNameTrimmed = (m.displayName ?? "").trim();
      return {
      userId: m.userId,
      email: m.email ?? "",
      displayName:
        displayNameTrimmed.length > 0
          ? displayNameTrimmed
          : (m.email?.split("@")[0] ?? ""),
      memberRole: m.memberRole,
      };
    }),
    pendingInvitations: pendingRows.map((p) => ({
      invitationId: p.id,
      email: p.email,
      inviteeDisplayName: p.inviteeDisplayName ?? null,
      expiresAt: p.expiresAt.toISOString(),
    })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId } = await context.params;
  if (!z.string().uuid().safeParse(clientId).success) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה לקוח לא תקין.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const name = parsed.data.displayName.trim();
  const nameTakenByOther = await accountantHasAnotherClientWithSameDisplayName({
    accountantUserId: session.user.id,
    displayName: name,
    excludeClientId: clientId,
  });
  if (nameTakenByOther) {
    return jsonError(
      409,
      "DUPLICATE_CLIENT_NAME",
      "כבר קיים לקוח אחר עם שם התצוגה הזה. נא לבחור שם אחר.",
    );
  }

  const updated = await db
    .update(clients)
    .set({
      displayName: name,
      updatedAt: new Date(),
    })
    .where(
      and(eq(clients.id, clientId), eq(clients.accountantId, session.user.id)),
    )
    .returning({
      id: clients.id,
      displayName: clients.displayName,
      status: clients.status,
    });

  if (updated.length === 0) {
    return jsonError(404, "NOT_FOUND", "הלקוח לא נמצא או שאין הרשאה.");
  }

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "accountant_rename_client",
    entityType: "client",
    entityId: clientId,
    payloadJson: {
      displayName: name,
    },
  });

  return Response.json({ client: updated[0] });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId } = await context.params;
  if (!z.string().uuid().safeParse(clientId).success) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה לקוח לא תקין.");
  }

  const result = await deleteClientOwnedByAccountant({
    clientId,
    accountantUserId: session.user.id,
    actorUserId: session.user.id,
  });

  if (!result.ok) {
    return jsonError(404, result.code, result.message);
  }

  return new Response(null, { status: 204 });
}
