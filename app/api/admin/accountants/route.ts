import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import { jsonError } from "@/lib/api/errors";
import { getPublicInviteUrl } from "@/lib/invitations/public-invite-url";
import { createAccountantInvitation } from "@/lib/invitations/service";
import { db } from "@/lib/db";
import { userRoles, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const postBodySchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "admin")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת אדמין.");
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(eq(userRoles.role, "accountant"));

  return Response.json({
    items: rows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.displayName,
      createdAt: r.createdAt?.toISOString() ?? null,
    })),
    nextCursor: null,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "admin")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת אדמין.");
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

  const created = await createAccountantInvitation({
    email: parsed.data.email,
    inviteeDisplayName: parsed.data.displayName ?? null,
    createdByUserId: session.user.id,
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
        "כבר קיימת הזמנה פעילה לכתובת הזו.",
      );
    }
    return jsonError(400, "INVITATION_FAILED", "לא ניתן ליצור הזמנה.");
  }

  const inviteUrl = getPublicInviteUrl(created.rawToken);
  console.info(
    "[invite] הזמנת רואה חשבון (מייל לא נשלח עדיין — קישור לפיתוח):",
    inviteUrl,
  );

  return Response.json(
    {
      invitationId: created.invitationId,
      email: created.email,
      expiresAt: created.expiresAt,
      inviteUrl,
    },
    { status: 201 },
  );
}
