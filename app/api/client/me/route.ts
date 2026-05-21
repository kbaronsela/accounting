import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { getClientMe } from "@/lib/client/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת לקוח.");
  }

  const data = await getClientMe(session.user.id);
  if (!data) {
    return jsonError(404, "NOT_FOUND", "משתמש לא נמצא.");
  }

  return Response.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      locale: data.user.locale ?? "he",
    },
    clients: data.clients,
  });
}
