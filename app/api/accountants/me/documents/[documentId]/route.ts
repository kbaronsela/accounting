import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { getDocumentDetailForAccountant } from "@/lib/accountant/documents-queries";
import { getPublicAppOrigin } from "@/lib/invitations/public-invite-url";
import { canonicalizeCurrency } from "@/lib/client/currency-canonical";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { documentId } = await context.params;
  const row = await getDocumentDetailForAccountant(session.user.id, documentId);
  if (!row) {
    return jsonError(404, "NOT_FOUND", "מסמך לא נמצא.");
  }

  const base = getPublicAppOrigin();
  const ttlMs = 15 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const downloadUrl = `${base}/api/accountants/me/documents/${documentId}/file`;

  return Response.json({
    id: row.id,
    clientId: row.clientId,
    clientDisplayName: row.clientDisplayName,
    status: row.status,
    finalAmount: row.finalAmount,
    finalCurrency: canonicalizeCurrency(row.finalCurrency),
    finalDate: row.finalDate,
    finalVendor: row.finalVendor,
    clientNote: row.clientNote,
    extracted: row.extracted ?? null,
    submittedAt: row.submittedAt,
    file: {
      mimeType: row.mimeType,
      downloadUrl,
      expiresAt,
    },
  });
}
