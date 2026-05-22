import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { getPublicInviteUrl } from "@/lib/invitations/public-invite-url";
import { inviteAdditionalClientMember } from "@/lib/invitations/service";
import { z } from "zod";

const postBodySchema = z.object({
  email: z.string().email(),
  inviteeDisplayName: z.string().min(1).max(200).optional(),
  memberRole: z.enum(["primary", "member"]).optional().default("member"),
});

type RouteContext = { params: Promise<{ clientId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId } = await context.params;

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

  const created = await inviteAdditionalClientMember({
    accountantUserId: session.user.id,
    clientId,
    email: parsed.data.email,
    inviteeDisplayName: parsed.data.inviteeDisplayName ?? null,
    memberRole: parsed.data.memberRole,
  });

  if (!created.ok) {
    if (created.reason === "forbidden") {
      return jsonError(403, "FORBIDDEN", "אין גישה ללקוח זה.");
    }
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
        "כבר קיימת הזמנה פעילה לכתובת המייל הזו.",
      );
    }
    return jsonError(400, "INVITATION_FAILED", "לא ניתן ליצור הזמנה.");
  }

  const inviteUrl = getPublicInviteUrl(created.rawToken);
  console.info("[invite] חבר נוסף לתיק (קישור לפיתוח):", inviteUrl);

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
