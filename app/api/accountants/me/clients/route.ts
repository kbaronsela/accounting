import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clientMembers, clients } from "@/lib/db/schema";
import { createClientWithInvitations } from "@/lib/invitations/service";
import { getPublicInviteUrl } from "@/lib/invitations/public-invite-url";
import { and, count, eq, ilike } from "drizzle-orm";
import { z } from "zod";

const invitedUserSchema = z.object({
  email: z.string().email(),
  inviteeDisplayName: z.string().max(300).optional(),
});

const postBodySchema = z
  .object({
    clientName: z.string().min(1).max(300),
    users: z.array(invitedUserSchema).min(1).max(4),
  })
  .superRefine((d, ctx) => {
    const keys = d.users.map((u) => u.email.trim().toLowerCase());
    const unique = new Set(keys);
    if (unique.size !== keys.length) {
      ctx.addIssue({
        path: ["users"],
        code: z.ZodIssueCode.custom,
        message: "כתובות האימייל של המוזמנים חייבות להיות שונות.",
      });
    }
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
    .groupBy(clients.id, clients.displayName, clients.status, clients.createdAt);

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

  const invitationsIn = parsed.data.users.map((u) => ({
    email: u.email,
    inviteeDisplayName: u.inviteeDisplayName?.trim()
      ? u.inviteeDisplayName.trim()
      : null,
  }));

  const created = await createClientWithInvitations({
    accountantUserId: session.user.id,
    clientDisplayName: parsed.data.clientName.trim(),
    invitations: invitationsIn,
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
        "כבר קיימת הזמנה פעילה עם אחד מכתובות האימייל.",
      );
    }
    if (created.reason === "duplicate_emails_in_request") {
      return jsonError(400, "VALIDATION_ERROR", "כפילות באימיילים.");
    }
    if (created.reason === "invite_count") {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "נדרש בין משתמש אחד לארבעה.",
      );
    }
    return jsonError(400, "INVITATION_FAILED", "לא ניתן ליצור את הלקוח והזמנות.");
  }

  for (const inv of created.invites) {
    const inviteUrl = getPublicInviteUrl(inv.rawToken);
    console.info("[invite] לקוח חדש + הזמנה (בפיתוח — קישור):", inviteUrl);
  }

  return Response.json(
    {
      client: created.client,
      invitations: created.invites.map((i) => ({
        invitationId: i.invitationId,
        email: i.email,
        expiresAt: i.expiresAt,
        inviteUrl: getPublicInviteUrl(i.rawToken),
      })),
    },
    { status: 201 },
  );
}
