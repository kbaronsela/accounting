import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { ingestClientUploadedBufferAndStartOcr } from "@/lib/client/ingest-client-upload-from-buffer";
import {
  deleteShareStagingQuiet,
  loadShareStagingPayload,
} from "@/lib/uploads/share-target-staging";
import { isAllowedUploadMime } from "@/lib/uploads/config";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  stagingId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "client")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת לקוח.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const { stagingId, clientId } = parsed.data;
  const userId = session.user.id;

  const staged = await loadShareStagingPayload(userId, stagingId);
  if (!staged) {
    return jsonError(
      400,
      "STAGING_EXPIRED",
      "פג התוקף של הקובץ או שנמחק. נסו שיתוף שוב.",
    );
  }

  const { buffer, meta } = staged;

  if (!isAllowedUploadMime(meta.mimeType)) {
    await deleteShareStagingQuiet(userId, stagingId).catch(() => {});
    return jsonError(400, "VALIDATION_ERROR", "סוג MIME לא נתמך למסך זה.");
  }
  const mimeType = meta.mimeType;

  try {
    const result = await ingestClientUploadedBufferAndStartOcr({
      userId,
      clientId,
      mimeType,
      buffer,
    });

    if (!result.ok) {
      return jsonError(400, "INGEST_FAILED", result.message);
    }

    await deleteShareStagingQuiet(userId, stagingId).catch(() => {});

    return Response.json({
      ok: true,
      documentId: result.documentId,
    });
  } catch {
    return jsonError(500, "SERVER_ERROR", "אירעה שגיאה בהשלמת השיתוף.");
  }
}
