import "server-only";

import { randomUUID } from "node:crypto";
import { deleteUploadedDocumentAfterDbChange } from "@/lib/uploads/document-storage";
import { db } from "@/lib/db";
import {
  auditEvents,
  clients,
  documents,
  userRoles,
  users,
} from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

type DrizzleTxn = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

async function accountantClientCount(tx: DrizzleTxn, accountantUserId: string) {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(clients)
    .where(eq(clients.accountantId, accountantUserId));
  return Number(row?.n ?? 0);
}

async function loadDocumentsForAccountantFileCleanup(
  tx: DrizzleTxn,
  accountantUserId: string,
) {
  const rows = await tx
    .select({
      id: documents.id,
      storageObjectKey: documents.storageObjectKey,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .where(eq(clients.accountantId, accountantUserId));
  return rows;
}

async function userHasRoleAccountant(tx: DrizzleTxn, userId: string) {
  const rows = await tx
    .select({ x: sql`1` })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "accountant")))
    .limit(1);
  return rows.length > 0;
}

export type RemoveAccountantResolution =
  | { kind: "none" }
  | { kind: "delete_all_clients" }
  | { kind: "transfer_clients"; targetAccountantUserId: string };

type RemoveFailure = {
  ok: false;
  code:
    | "NOT_ACCOUNTANT"
    | "HAS_CLIENTS_AMBIGUOUS"
    | "INVALID_TRANSFER_TARGET"
    | "TRANSFER_SELF"
    | "CANNOT_REMOVE_SELF"
    | "INTERNAL_ERROR";
  message: string;
};

type TxOk = {
  ok: true;
  removedUserEntirely: boolean;
  previousClientCount: number;
  docIdsForFileCleanup: { id: string; storageObjectKey: string }[];
};

/** ריק מחוץ ל־transaction; מוחק קבצי מסמכים (מקומי או S3) אחרי commit מוצלח */
export async function removeAccountantUser(params: {
  actorUserId: string;
  accountantUserId: string;
  resolution: RemoveAccountantResolution;
}): Promise<
  | { ok: true; removedUserEntirely: boolean; previousClientCount: number }
  | RemoveFailure
> {
  const { actorUserId, accountantUserId, resolution } = params;

  if (actorUserId === accountantUserId) {
    return {
      ok: false,
      code: "CANNOT_REMOVE_SELF",
      message: "לא ניתן להסיר רואה חשבון עבור המשתמש המחובר בפועל זה.",
    };
  }

  try {
    const txResult = await db.transaction(async (tx): Promise<TxOk | RemoveFailure> => {
      const isAcct = await userHasRoleAccountant(tx, accountantUserId);
      if (!isAcct) {
        return {
          ok: false as const,
          code: "NOT_ACCOUNTANT" as const,
          message: "המשתמש אינו רואה חשבון במערכת.",
        };
      }

      const clientCount = await accountantClientCount(tx, accountantUserId);
      let docIdsForFileCleanup: { id: string; storageObjectKey: string }[] = [];

      if (clientCount > 0) {
        if (resolution.kind === "none") {
          return {
            ok: false as const,
            code: "HAS_CLIENTS_AMBIGUOUS" as const,
            message:
              "לרואה חשבון זה יש לקוחות. יש לבחור בין העברת כל התיקים לרואה חשבון אחר לבין מחיקת הלקוחות.",
          };
        }
        if (resolution.kind === "transfer_clients") {
          if (
            resolution.targetAccountantUserId.trim() === accountantUserId.trim()
          ) {
            return {
              ok: false as const,
              code: "TRANSFER_SELF" as const,
              message: "לא ניתן להעביר אל אותו רואה חשבון.",
            };
          }
          const targetOk = await userHasRoleAccountant(
            tx,
            resolution.targetAccountantUserId,
          );
          if (!targetOk) {
            return {
              ok: false as const,
              code: "INVALID_TRANSFER_TARGET" as const,
              message: "יעד ההעברה חייב להיות משתמש עם תפקיד רואה חשבון.",
            };
          }
          await tx
            .update(clients)
            .set({
              accountantId: resolution.targetAccountantUserId,
              updatedAt: new Date(),
            })
            .where(eq(clients.accountantId, accountantUserId));
        } else if (resolution.kind === "delete_all_clients") {
          docIdsForFileCleanup = await loadDocumentsForAccountantFileCleanup(
            tx,
            accountantUserId,
          );
          await tx.delete(clients).where(eq(clients.accountantId, accountantUserId));
        }
      }

      await tx.delete(userRoles).where(
        and(
          eq(userRoles.userId, accountantUserId),
          eq(userRoles.role, "accountant"),
        ),
      );

      const remainingRoles = await tx
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, accountantUserId));

      let removedUserEntirely = false;
      if (remainingRoles.length === 0) {
        await tx.delete(users).where(eq(users.id, accountantUserId));
        removedUserEntirely = true;
      }

      await tx.insert(auditEvents).values({
        id: randomUUID(),
        actorUserId,
        action: "admin_remove_accountant",
        entityType: "user",
        entityId: accountantUserId,
        payloadJson: {
          previousClientCount: clientCount,
          resolution: resolution.kind,
          removedUserEntirely,
          transferTo:
            resolution.kind === "transfer_clients"
              ? resolution.targetAccountantUserId
              : null,
        },
      });

      return {
        ok: true as const,
        removedUserEntirely,
        previousClientCount: clientCount,
        docIdsForFileCleanup,
      };
    });

    if (!txResult.ok) {
      return txResult;
    }

    for (const doc of txResult.docIdsForFileCleanup) {
      await deleteUploadedDocumentAfterDbChange(doc.storageObjectKey, doc.id);
    }

    return {
      ok: true,
      removedUserEntirely: txResult.removedUserEntirely,
      previousClientCount: txResult.previousClientCount,
    };
  } catch (e) {
    const msg =
      typeof e === "object" &&
      e !== null &&
      "message" in e &&
      typeof (e as { message: unknown }).message === "string"
        ? (e as { message: string }).message
        : String(e);
    console.error("[admin] remove accountant failed:", msg);
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "פעולת המערכת נכשלה. יש לנסות שוב או לבדוק את הלוג.",
    };
  }
}
