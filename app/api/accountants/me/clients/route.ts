import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clientMembers, clients } from "@/lib/db/schema";
import { getPublicInviteUrl } from "@/lib/invitations/public-invite-url";
import {
  createClientWithInvitation,
} from "@/lib/invitations/service";
import { and, count, eq, ilike } from "drizzle-orm";
import { z } from "zod";

const postBodySchema = z.object({
  displayName: z.string().min(1).max(300),
  inviteEmail: z.string().email(),
  inviteeDisplayName: z.string().min(1).max(200).optional(),
  memberRole: z.enum(["primary", "member"]).optional().default("primary"),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();
  const search = searchParams.get("search")?.trim();

  const conditions = [eq(clients.accountantId, session.user.id)];
  if (status && status.length > 0) {
    conditions.push(eq(clients.status, status));
  }
  if (search && search.length > 0) {
    const safe = search.replace(/[%_]/g, "\\$&");
    conditions.push(ilike(clients.displayName, `%${safe}%`));
  }

  const rows = await db
    .select({
      id: clients.id,
      displayName: clients.displayName,
      status: clients.status,
      createdAt: clients.createdAt,
      memberCount: count(clientMembers.userId),
    })
    .from(clients)
    .leftJoin(clientMembers, eq(clientMembers.clientId, clients.id))
    .where(and(...conditions))
    .groupBy(
      clients.id,
      clients.displayName,
      clients.status,
      clients.createdAt,
    );

  return Response.json({
    items: rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      status: r.status,
      memberCount: Number(r.memberCount),
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: null,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const created = await createClientWithInvitation({
    accountantUserId: session.user.id,
    displayName: parsed.data.displayName,
    inviteEmail: parsed.data.inviteEmail,
    inviteeDisplayName: parsed.data.inviteeDisplayName ?? null,
    memberRole: parsed.data.memberRole,
  });

  if (!created.ok) {
    if (created.reason === "email_taken") {
      return jsonError(
        409,
        "EMAIL_IN_USE",
        "כתובת המייל כבר רשומה במערכת.",
      );
    }
    if (created.reason === "pending_invitation") {
      return jsonError(
        409,
        "PENDING_INVITATION",
        "כבר קיימת הזמנה פעילה ללקוח עם כתובת המייל הזו.",
      );
    }
    return jsonError(400, "INVITATION_FAILED", "לא ניתן ליצור תיק והזמנה.");
  }

  const inviteUrl = getPublicInviteUrl(created.rawToken);
  console.info(
    "[invite] תיק לקוח + הזמנה (מייל לא נשלח עדיין — קישור לפיתוח):",
    inviteUrl,
  );

  return Response.json(
    {
      client: created.client,
      invitationId: created.invitationId,
      expiresAt: created.expiresAt,
      inviteUrl,
    },
    { status: 201 },
  );
}
