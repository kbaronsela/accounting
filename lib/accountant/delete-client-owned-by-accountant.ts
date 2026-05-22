import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { auditEvents, clients, documents } from "@/lib/db/schema";
import { deleteLocalDocumentFile } from "@/lib/uploads/local-store";
import { and, eq } from "drizzle-orm";

const notFoundSentinel = "__delete_client_not_found__";

/**
 * קורא למחוק את הלקוח ואת מסמכיו (DB + קבצי upload מקומיים).
 */
export async function deleteClientOwnedByAccountant(params: {
  clientId: string;
  accountantUserId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND"; message: string }> {
  const { clientId, accountantUserId, actorUserId } = params;

  let docIdsForFiles: string[] = [];

  try {
    await db.transaction(async (tx) => {
      const docRows = await tx
        .select({ id: documents.id })
        .from(documents)
        .innerJoin(clients, eq(documents.clientId, clients.id))
        .where(
          and(
            eq(clients.id, clientId),
            eq(clients.accountantId, accountantUserId),
          ),
        );
      docIdsForFiles = docRows.map((r) => r.id);

      const deleted = await tx
        .delete(clients)
        .where(
          and(
            eq(clients.id, clientId),
            eq(clients.accountantId, accountantUserId),
          ),
        )
        .returning({ id: clients.id });

      if (deleted.length === 0) {
        throw new Error(notFoundSentinel);
      }

      await tx.insert(auditEvents).values({
        id: randomUUID(),
        actorUserId,
        action: "accountant_delete_client",
        entityType: "client",
        entityId: clientId,
        payloadJson: {
          accountantUserId,
          documentsRemovedCount: docIdsForFiles.length,
        },
      });
    });
  } catch (e) {
    const msg =
      e instanceof Error && e.message === notFoundSentinel
        ? "NOT_FOUND"
        : "";
    if (msg === "NOT_FOUND") {
      return {
        ok: false as const,
        code: "NOT_FOUND" as const,
        message: "הלקוח לא נמצא או שאין הרשאה.",
      };
    }
    throw e;
  }

  for (const id of docIdsForFiles) {
    await deleteLocalDocumentFile(id);
  }

  return { ok: true as const };
}
