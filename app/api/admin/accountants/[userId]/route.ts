import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import { jsonError } from "@/lib/api/errors";
import type { RemoveAccountantResolution } from "@/lib/admin/accountant-removal";
import { removeAccountantUser } from "@/lib/admin/accountant-removal";
import { db } from "@/lib/db";
import {
  accounts,
  auditEvents,
  clients,
  userRoles,
  users,
} from "@/lib/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";

type RouteContext = { params: Promise<{ userId: string }> };

const patchBodySchema = z
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

const deleteBodySchema = z.object({
  /** מחיקת תיקים ולקוחות (כולל מסמכים במסד) — רק כש-accountant עם לקוחות */
  deleteAllClients: z.boolean().optional(),
  /** UUID של רואה חשבון יעד — רק בהעברה */
  transferToAccountantUserId: z.string().uuid().optional(),
});

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "admin")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת אדמין.");
  }

  const { userId: accountantUserId } = await context.params;

  if (!z.string().uuid().safeParse(accountantUserId).success) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה רואה חשבון לא תקין.");
  }

  const [acctRole] = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, accountantUserId),
        eq(userRoles.role, "accountant"),
      ),
    )
    .limit(1);
  if (!acctRole) {
    return jsonError(404, "NOT_ACCOUNTANT", "משתמש לא מופיע כרואה חשבון.");
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
          eq(accounts.userId, accountantUserId),
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
      .where(
        and(eq(users.email, newEmailNorm), ne(users.id, accountantUserId)),
      )
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
    parsed.data.displayName !== undefined
      ? parsed.data.displayName.trim()
      : undefined;

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

  await db.update(users).set(updates).where(eq(users.id, accountantUserId));

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "admin_update_accountant",
    entityType: "user",
    entityId: accountantUserId,
    payloadJson: {
      displayName: nameUpdate ?? null,
      email: newEmailNorm ?? null,
    },
  });

  const [after] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, accountantUserId))
    .limit(1);

  const [{ n }] = await db
    .select({
      n: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(clients)
    .where(eq(clients.accountantId, accountantUserId));

  return Response.json({
    item: after
      ? {
          id: after.id,
          email: after.email,
          displayName: after.name,
          createdAt: after.createdAt?.toISOString() ?? null,
          clientCount: Number(n ?? 0),
        }
      : null,
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "admin")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת אדמין.");
  }

  const { userId: accountantUserId } = await context.params;

  if (!z.string().uuid().safeParse(accountantUserId).success) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה רואה חשבון לא תקין.");
  }

  let bodyUnknown: unknown = {};
  try {
    const t = await request.text();
    if (t.trim().length > 0) bodyUnknown = JSON.parse(t);
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = deleteBodySchema.safeParse(bodyUnknown);
  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const hasTransfer = Boolean(parsed.data.transferToAccountantUserId);
  const hasDeleteClients = parsed.data.deleteAllClients === true;
  if (hasTransfer && hasDeleteClients) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "בחרי או העברה לרואה חשבון אחר או מחיקת לקוחות — לא את שני הפעולות.",
    );
  }

  let resolution: RemoveAccountantResolution = { kind: "none" };
  if (hasTransfer && parsed.data.transferToAccountantUserId) {
    resolution = {
      kind: "transfer_clients",
      targetAccountantUserId: parsed.data.transferToAccountantUserId,
    };
  } else if (hasDeleteClients) {
    resolution = { kind: "delete_all_clients" };
  }

  const result = await removeAccountantUser({
    actorUserId: session.user.id,
    accountantUserId,
    resolution,
  });

  if (!result.ok) {
    const status =
      result.code === "INTERNAL_ERROR"
        ? 500
        : result.code === "NOT_ACCOUNTANT"
          ? 404
          : 400;
    return jsonError(status, result.code, result.message);
  }

  return Response.json({
    removedUserEntirely: result.removedUserEntirely,
    previousClientCount: result.previousClientCount,
  });
}
