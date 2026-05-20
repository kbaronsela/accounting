import { lookupInvitationByRawToken } from "@/lib/invitations/service";
import { jsonError } from "@/lib/api/errors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return jsonError(400, "VALIDATION_ERROR", 'חסר פרמטר "token".');
  }

  const result = await lookupInvitationByRawToken(token);
  if (!result.ok) {
    if (result.reason === "expired") {
      return jsonError(410, "INVITATION_EXPIRED", "תוקף ההזמנה פג או שהיא בוטלה.");
    }
    return jsonError(404, "INVITATION_NOT_FOUND", "ההזמנה לא נמצאה.");
  }

  return Response.json(result.data);
}
