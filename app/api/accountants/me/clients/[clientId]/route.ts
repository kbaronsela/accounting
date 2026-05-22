import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { deleteClientOwnedByAccountant } from "@/lib/accountant/delete-client-owned-by-accountant";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { auditEvents, clients } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

type RouteContext = { params: Promise<{ clientId: string }> };

const patchBodySchema = z.object({
  displayName: z.string().min(1).max(300),
});

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId } = await context.params;
  if (!z.string().uuid().safeParse(clientId).success) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה תיק לא תקין.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const name = parsed.data.displayName.trim();
  const updated = await db
    .update(clients)
    .set({
      displayName: name,
      updatedAt: new Date(),
    })
    .where(
      and(eq(clients.id, clientId), eq(clients.accountantId, session.user.id)),
    )
    .returning({
      id: clients.id,
      displayName: clients.displayName,
      status: clients.status,
    });

  if (updated.length === 0) {
    return jsonError(404, "NOT_FOUND", "התיק לא נמצא או שאין הרשאה.");
  }

  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: session.user.id,
    action: "accountant_rename_client",
    entityType: "client",
    entityId: clientId,
    payloadJson: {
      displayName: name,
    },
  });

  return Response.json({ client: updated[0] });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { clientId } = await context.params;
  if (!z.string().uuid().safeParse(clientId).success) {
    return jsonError(400, "VALIDATION_ERROR", "מזהה תיק לא תקין.");
  }

  const result = await deleteClientOwnedByAccountant({
    clientId,
    accountantUserId: session.user.id,
    actorUserId: session.user.id,
  });

  if (!result.ok) {
    return jsonError(404, result.code, result.message);
  }

  return new Response(null, { status: 204 });
}
