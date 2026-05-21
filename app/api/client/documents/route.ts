import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { listDocumentsForClientUser } from "@/lib/client/queries";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת לקוח.");
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId")?.trim() ?? undefined;
  const status = searchParams.get("status")?.trim() ?? undefined;
  const limitRaw = searchParams.get("limit");

  let limit = 50;
  if (limitRaw) {
    const n = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(n)) {
      return jsonError(400, "VALIDATION_ERROR", "פרמטר limit אינו מספר תקין.");
    }
    limit = n;
  }

  const result = await listDocumentsForClientUser(session.user.id, {
    clientId: clientId || null,
    status: status || null,
    limit,
  });

  if (!result.ok) {
    if (result.reason === "invalid_client_id") {
      return jsonError(400, "VALIDATION_ERROR", "מזהה תיק לא תקין.");
    }
    return jsonError(403, "FORBIDDEN", "אין גישה לתיק המבוקש.");
  }

  return Response.json({
    items: result.items,
    nextCursor: null,
  });
}
