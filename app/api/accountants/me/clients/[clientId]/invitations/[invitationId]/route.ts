import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { getClientOwnedByAccountant } from "@/lib/accountant/assert-accountant-client-access";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { auditEvents, invitations, users } from "@/lib/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ clientId: string; invitationId: string }>;
};

const patchSchema = z
  .object({
    inviteeDisplayName: z.string().max(300).optional(),
    email: z.string().email().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.inviteeDisplayName === undefined && d.email === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "נדרש עדכון לשם או למייל.",
      });
    }
  });

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId, invitationId } = await context.params;
  if (
    !z.string().uuid().safeParse(clientId).success ||
    !z.string().uuid().safeParse(invitationId).success
  ) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה לא תקין.");
  }

  const owned = await getClientOwnedByAccountant(session.user.id, clientId);
  if (!owned) {
    return jsonError(404, "NOT_FOUND", "הלקוח לא נמצא או שאין הרשאה.");
  }

  const [inv] = await db.select().from(invitations).where(eq(invitations.id, invitationId)).limit(1);

  if (!inv || inv.clientId !== clientId || inv.consumedAt !== null || inv.role !== "client") {
    return jsonError(404, "NOT_FOUND", "ההזמנה לא נמצאה או שאינה פעילה.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const emailNorm =
    parsed.data.email !== undefined ? parsed.data.email.trim().toLowerCase() : undefined;

  if (emailNorm !== undefined && emailNorm !== inv.email.toLowerCase()) {
    const [userExists] = await db.select({ id: users.id }).from(users).where(eq(users.email, emailNorm)).limit(1);
    if (userExists) {
      return jsonError(409, "EMAIL_IN_USE", "כתובת המייל כבר רשומה במערכת.");
    }

    const [pendingOther] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.email, emailNorm),
          eq(invitations.role, "client"),
          isNull(invitations.consumedAt),
          ne(invitations.id, invitationId),
        ),
      )
      .limit(1);
    if (pendingOther) {
      return jsonError(
        409,
        "PENDING_INVITATION",
        "כבר קיימת הזמנה פעילה עם כתובת המייל הזו.",
      );
    }
  }

  const invitesName =
    parsed.data.inviteeDisplayName !== undefined
      ? parsed.data.inviteeDisplayName.trim()
      : undefined;

  const upsertPatch: Partial<{
    email: string;
    inviteeDisplayName: string | null;
  }> = {};

  if (emailNorm !== undefined) {
    upsertPatch.email = emailNorm;
  }

  if (invitesName !== undefined) {
    upsertPatch.inviteeDisplayName = invitesName.length > 0 ? invitesName : null;
  }

  if (Object.keys(upsertPatch).length === 0) {
    return jsonError(400, "VALIDATION_ERROR", "אין מה לעדכן.");
  }

  await db.update(invitations).set(upsertPatch).where(eq(invitations.id, invitationId));

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "accountant_update_client_invitation",
    entityType: "invitation",
    entityId: invitationId,
    payloadJson: {
      clientId,
      email: emailNorm ?? null,
      inviteeDisplayName: invitesName ?? null,
    },
  });

  const [after] = await db
    .select({
      invitationId: invitations.id,
      email: invitations.email,
      inviteeDisplayName: invitations.inviteeDisplayName,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);

  return Response.json({
    pendingInvitation: after
      ? {
          invitationId: after.invitationId,
          email: after.email,
          inviteeDisplayName: after.inviteeDisplayName ?? null,
          expiresAt: after.expiresAt.toISOString(),
        }
      : null,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId, invitationId } = await context.params;
  if (
    !z.string().uuid().safeParse(clientId).success ||
    !z.string().uuid().safeParse(invitationId).success
  ) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה לא תקין.");
  }

  const owned = await getClientOwnedByAccountant(session.user.id, clientId);
  if (!owned) {
    return jsonError(404, "NOT_FOUND", "הלקוח לא נמצא או שאין הרשאה.");
  }

  const [updated] = await db
    .update(invitations)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.clientId, clientId),
        isNull(invitations.consumedAt),
        eq(invitations.role, "client"),
      ),
    )
    .returning({ id: invitations.id });

  if (!updated) {
    return jsonError(404, "NOT_FOUND", "ההזמנה לא נמצאה או שכבר טופלה.");
  }

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "accountant_revoke_client_invitation",
    entityType: "invitation",
    entityId: invitationId,
    payloadJson: { clientId },
  });

  return new Response(null, { status: 204 });
}
