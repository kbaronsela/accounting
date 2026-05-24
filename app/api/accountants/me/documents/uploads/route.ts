import { auth } from "@/auth";
import { assertAccountantOwnsClient } from "@/lib/accountant/documents-queries";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getPublicAppOrigin } from "@/lib/invitations/public-invite-url";
import {
  isAllowedUploadMime,
  UPLOAD_MAX_BYTES,
} from "@/lib/uploads/config";
import { newDocumentStorageObjectKey } from "@/lib/uploads/document-storage";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const postBodySchema = z.object({
  clientId: z.string().uuid(),
  mimeType: z.string().min(1).max(200),
  byteSize: z.number().int().positive(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
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

  const { clientId, mimeType, byteSize } = parsed.data;

  if (!isAllowedUploadMime(mimeType)) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "סוג MIME לא נתמך. מותר: JPEG, PNG, WebP, PDF.",
    );
  }
  if (byteSize > UPLOAD_MAX_BYTES) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      `הקובץ חורג מהגודל המרבי (${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} מ״ב).`,
    );
  }

  const ok = await assertAccountantOwnsClient(session.user.id, clientId);
  if (!ok) {
    return jsonError(403, "FORBIDDEN", "אין גישה לתיק זה.");
  }

  const documentId = randomUUID();
  const storageObjectKey = newDocumentStorageObjectKey(documentId);
  const now = new Date();

  await db.insert(documents).values({
    id: documentId,
    clientId,
    uploadedByUserId: session.user.id,
    storageObjectKey,
    mimeType,
    byteSize,
    status: "draft_uploading",
    updatedAt: now,
  });

  const base = getPublicAppOrigin();
  const uploadUrl = `${base}/api/accountants/me/documents/${documentId}/upload`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  return Response.json(
    {
      documentId,
      upload: {
        method: "PUT",
        url: uploadUrl,
        headers: { "Content-Type": mimeType },
      },
      expiresAt: expiresAt.toISOString(),
    },
    { status: 201 },
  );
}
