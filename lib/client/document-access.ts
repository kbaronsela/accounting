import { db } from "@/lib/db";
import { clientMembers, documents } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type ClientDocumentRow = typeof documents.$inferSelect;

/**
 * מחזיר את רשומת המסמך אם המשתמש חבר ב־client_id שלו.
 */
export async function getDocumentForClientMember(
  userId: string,
  documentId: string,
): Promise<ClientDocumentRow | null> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) return null;
  const [member] = await db
    .select({ clientId: clientMembers.clientId })
    .from(clientMembers)
    .where(
      and(
        eq(clientMembers.clientId, doc.clientId),
        eq(clientMembers.userId, userId),
      ),
    )
    .limit(1);
  if (!member) return null;
  return doc;
}

export async function getDocumentStorageMetaForClient(
  userId: string,
  documentId: string,
): Promise<{ id: string; mimeType: string; storageObjectKey: string } | null> {
  const doc = await getDocumentForClientMember(userId, documentId);
  if (!doc) return null;
  return {
    id: doc.id,
    mimeType: doc.mimeType,
    storageObjectKey: doc.storageObjectKey,
  };
}
