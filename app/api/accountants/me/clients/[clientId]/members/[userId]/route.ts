import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { getClientOwnedByAccountant } from "@/lib/accountant/assert-accountant-client-access";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { accounts, auditEvents, clientMembers, userRoles, users } from "@/lib/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ clientId: string; userId: string }>;
};

const patchSchema = z
  .object({
    displayName: z.string().min(1).max(300).optional(),
    email: z.string().email().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.displayName === undefined && d.email === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "נדרש שם תצוגה או אימייל.",
      });
    }
  });

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId, userId } = await context.params;
  if (
    !z.string().uuid().safeParse(clientId).success ||
    !z.string().uuid().safeParse(userId).success
  ) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה לא תקין.");
  }

  const owned = await getClientOwnedByAccountant(session.user.id, clientId);
  if (!owned) {
    return jsonError(404, "NOT_FOUND", "הלקוח לא נמצא או שאין הרשאה.");
  }

  const [membership] = await db
    .select({ userId: clientMembers.userId })
    .from(clientMembers)
    .where(and(eq(clientMembers.clientId, clientId), eq(clientMembers.userId, userId)))
    .limit(1);
  if (!membership) {
    return jsonError(404, "NOT_FOUND", "המשתמש לא משויך ללקוח זה.");
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

  const newEmailNorm =
    parsed.data.email !== undefined
      ? parsed.data.email.trim().toLowerCase()
      : undefined;

  if (newEmailNorm !== undefined) {
    const [oauthLinked] = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          inArray(accounts.provider, ["google", "facebook"]),
        ),
      )
      .limit(1);
    if (oauthLinked) {
      return jsonError(
        422,
        "EMAIL_CHANGE_FORBIDDEN",
        "לא ניתן לשנות אימייל למשתמש המקושר ל־Google או Facebook דרך מסך זה.",
      );
    }

    const [collision] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, newEmailNorm), ne(users.id, userId)))
      .limit(1);
    if (collision) {
      return jsonError(
        409,
        "EMAIL_IN_USE",
        "כתובת המייל כבר בשימוש אצל משתמש אחר.",
      );
    }
  }

  const nameUpdate =
    parsed.data.displayName !== undefined ? parsed.data.displayName.trim() : undefined;

  const updates: Partial<{
    name: string;
    email: string;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (nameUpdate !== undefined) {
    updates.name = nameUpdate;
  }
  if (newEmailNorm !== undefined) {
    updates.email = newEmailNorm;
  }

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existingUser) {
    return jsonError(404, "NOT_FOUND", "משתמש לא קיים.");
  }

  await db.update(users).set(updates).where(eq(users.id, userId));

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "accountant_update_client_member",
    entityType: "user",
    entityId: userId,
    payloadJson: {
      clientId,
      displayName: nameUpdate ?? null,
      email: newEmailNorm ?? null,
    },
  });

  const [after] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const displayName =
    (after?.name?.trim()?.length ?? 0) > 0
      ? after!.name!.trim()
      : (after?.email?.split("@")[0] ?? "");

  return Response.json({
    member: after
      ? {
          userId: after.id,
          email: after.email ?? "",
          displayName,
        }
      : null,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId, userId } = await context.params;
  if (
    !z.string().uuid().safeParse(clientId).success ||
    !z.string().uuid().safeParse(userId).success
  ) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה לא תקין.");
  }

  const owned = await getClientOwnedByAccountant(session.user.id, clientId);
  if (!owned) {
    return jsonError(404, "NOT_FOUND", "הלקוח לא נמצא או שאין הרשאה.");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(clientMembers)
      .where(and(eq(clientMembers.clientId, clientId), eq(clientMembers.userId, userId)));

    const [{ cnt }] = await tx
      .select({
        cnt: sql<number>`cast(count(*) as integer)`.mapWith(Number),
      })
      .from(clientMembers)
      .where(eq(clientMembers.userId, userId));

    if ((cnt ?? 0) === 0) {
      await tx.delete(userRoles).where(
        and(eq(userRoles.userId, userId), eq(userRoles.role, "client")),
      );
    }

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      actorUserId: session.user.id,
      action: "accountant_remove_client_member",
      entityType: "user",
      entityId: userId,
      payloadJson: { clientId },
    });
  });

  return new Response(null, { status: 204 });
}
