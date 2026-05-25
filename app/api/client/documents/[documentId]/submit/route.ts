import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { getDocumentForClientMember } from "@/lib/client/document-access";

type RouteContext = { params: Promise<{ documentId: string }> };

/** נשמר לתאימות URL; מחזור החיים המעודכן לא כולל גל נפרד של «הגשה לרו״ח». */
export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת לקוח.");
  }

  const { documentId } = await context.params;
  const doc = await getDocumentForClientMember(session.user.id, documentId);
  if (!doc) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }

  return jsonError(
    410,
    "GONE",
    "לא נדרש עוד שלב «הגשה לרו״ח». שמרו את השינויים בעמוד המסמך לאחר סטטוס «הועלה», ורואה החשבון יאשר את המסמך ברשימת המסמכים.",
  );
}
