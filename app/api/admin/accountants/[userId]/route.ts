import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import { jsonError } from "@/lib/api/errors";
import type { RemoveAccountantResolution } from "@/lib/admin/accountant-removal";
import { removeAccountantUser } from "@/lib/admin/accountant-removal";
import { z } from "zod";

type RouteContext = { params: Promise<{ userId: string }> };

const deleteBodySchema = z.object({
  /** מחיקת תיקים ולקוחות (כולל מסמכים במסד) — רק כש-accountant עם לקוחות */
  deleteAllClients: z.boolean().optional(),
  /** UUID של רואה חשבון יעד — רק בהעברה */
  transferToAccountantUserId: z.string().uuid().optional(),
});

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
