import { acceptInvitation } from "@/lib/invitations/service";
import { jsonError } from "@/lib/api/errors";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12, "הסיסמה חייבת להכיל לפחות 12 תווים."),
  locale: z.enum(["he", "en"]).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return jsonError(400, "VALIDATION_ERROR", msg || "נתונים לא תקינים.");
  }

  try {
    const result = await acceptInvitation({
      rawToken: parsed.data.token,
      password: parsed.data.password,
      locale: parsed.data.locale ?? "he",
    });

    if (!result.ok) {
      if (result.reason === "expired") {
        return jsonError(410, "INVITATION_EXPIRED", "תוקף ההזמנה פג.");
      }
      if (result.reason === "email_taken") {
        return jsonError(
          409,
          "EMAIL_IN_USE",
          "כתובת המייל כבר רשומה במערכת.",
        );
      }
      if (result.reason === "invalid_invitation") {
        return jsonError(400, "INVALID_INVITATION", "ההזמנה אינה תקינה.");
      }
      return jsonError(404, "INVITATION_NOT_FOUND", "ההזמנה לא נמצאה.");
    }

    return Response.json(
      {
        userId: result.userId,
        role: result.role,
        redirectTo: result.redirectTo,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "invitation_consume_race") {
      return jsonError(
        409,
        "INVITATION_CONFLICT",
        "ההזמנה כבר נוצלה. יש לנסות להתחבר.",
      );
    }
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "23505"
    ) {
      return jsonError(
        409,
        "EMAIL_IN_USE",
        "כתובת המייל כבר רשומה במערכת.",
      );
    }
    throw e;
  }
}
