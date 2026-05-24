import { db } from "@/lib/db";
import { alias } from "drizzle-orm/pg-core";
import { clients, documents, users } from "@/lib/db/schema";
import {
  and,
  desc,
  eq,
  isNotNull,
  ne,
  sql,
} from "drizzle-orm";
import type { ClientDocumentRow } from "@/lib/client/document-access";
import { canonicalizeCurrency } from "@/lib/client/currency-canonical";

export type AccountantDocumentListItem = {
  id: string;
  clientId: string;
  clientDisplayName: string;
  status: string;
  mimeType: string;
  finalAmount: string | null;
  finalCurrency: string | null;
  finalDate: string | null;
  finalVendor: string | null;
  submittedAt: string | null;
  uploadedByDisplayName: string | null;
  updatedAt: string;
};

export type AccountantDocumentDetail = {
  id: string;
  clientId: string;
  clientDisplayName: string;
  status: string;
  finalAmount: string | null;
  finalCurrency: string | null;
  finalDate: string | null;
  finalVendor: string | null;
  finalInvoiceNumber: string | null;
  extractedInvoiceNumber: string | null;
  clientNote: string | null;
  extracted: unknown;
  submittedAt: string | null;
  mimeType: string;
};

function uuidPattern(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function startOfUtcDay(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const d = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function endOfUtcDayExclusive(dateStr: string): Date | null {
  const day = startOfUtcDay(dateStr);
  if (!day) return null;
  return new Date(day.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * מאמת שהתיק שייך לרואה החשבון.
 */
export async function assertAccountantOwnsClient(
  accountantUserId: string,
  clientId: string,
): Promise<boolean> {
  if (!uuidPattern(clientId)) return false;
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(eq(clients.id, clientId), eq(clients.accountantId, accountantUserId)),
    )
    .limit(1);
  return !!row;
}

/**
 * מסמך ששייך ללקוח של רואה החשבון (לכל סיבות הרשאה, כולל טיוטת העלאה).
 */
export async function getDocumentForAccountantAccess(
  accountantUserId: string,
  documentId: string,
): Promise<ClientDocumentRow | null> {
  if (!uuidPattern(documentId)) return null;
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) return null;
  const ok = await assertAccountantOwnsClient(accountantUserId, doc.clientId);
  if (!ok) return null;
  return doc;
}

const uploader = alias(users, "doc_uploader");

function uploadedByDisplayLabel(
  name: string | null | undefined,
): string | null {
  const n = name?.trim();
  if (n && n.length > 0) return n;
  return null;
}

export async function listDocumentsForAccountant(
  accountantUserId: string,
  options: {
    clientId?: string | null;
    status?: string | null;
    fromSubmittedDate?: string | null;
    toSubmittedDate?: string | null;
    /** YYYY-MM-DD — לפי `finalDate` ואם ריק אז `extractedDate` */
    fromInvoiceDate?: string | null;
    toInvoiceDate?: string | null;
    minAmount?: number | null;
    maxAmount?: number | null;
    limit?: number;
  },
): Promise<AccountantDocumentListItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  if (options.clientId) {
    const ok = await assertAccountantOwnsClient(
      accountantUserId,
      options.clientId,
    );
    if (!ok) return [];
  }

  const conditions = [eq(clients.accountantId, accountantUserId)];

  const statusNorm = options.status?.trim().toLowerCase() ?? "";
  if (statusNorm === "all") {
    /* אין סינון סטטוס */
  } else if (statusNorm.length > 0) {
    conditions.push(eq(documents.status, statusNorm));
  } else {
    conditions.push(ne(documents.status, "draft_uploading"));
  }

  if (options.clientId) {
    conditions.push(eq(documents.clientId, options.clientId));
  }

  if (options.fromSubmittedDate) {
    const from = startOfUtcDay(options.fromSubmittedDate);
    if (from) {
      conditions.push(isNotNull(documents.submittedAt));
      conditions.push(sql`${documents.submittedAt} >= ${from}`);
    }
  }

  if (options.toSubmittedDate) {
    const toExcl = endOfUtcDayExclusive(options.toSubmittedDate);
    if (toExcl) {
      conditions.push(isNotNull(documents.submittedAt));
      conditions.push(sql`${documents.submittedAt} < ${toExcl}`);
    }
  }

  const fromInv = options.fromInvoiceDate?.trim() ?? "";
  const toInv = options.toInvoiceDate?.trim() ?? "";
  const isoDay = /^\d{4}-\d{2}-\d{2}$/;
  if (fromInv || toInv) {
    const invoiceDay = sql`COALESCE(NULLIF(TRIM(${documents.finalDate}), ''), NULLIF(TRIM(${documents.extractedDate}), ''))`;
    if (fromInv && isoDay.test(fromInv)) {
      conditions.push(sql`${invoiceDay} >= ${fromInv}`);
    }
    if (toInv && isoDay.test(toInv)) {
      conditions.push(sql`${invoiceDay} <= ${toInv}`);
    }
  }

  if (options.minAmount != null) {
    conditions.push(
      sql`(${documents.finalAmount})::decimal >= ${options.minAmount}`,
    );
  }
  if (options.maxAmount != null) {
    conditions.push(
      sql`(${documents.finalAmount})::decimal <= ${options.maxAmount}`,
    );
  }

  const rows = await db
    .select({
      id: documents.id,
      clientId: documents.clientId,
      clientDisplayName: clients.displayName,
      status: documents.status,
      mimeType: documents.mimeType,
      finalAmount: documents.finalAmount,
      finalCurrency: documents.finalCurrency,
      finalDate: documents.finalDate,
      finalVendor: documents.finalVendor,
      submittedAt: documents.submittedAt,
      uploadedByName: uploader.name,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .innerJoin(uploader, eq(documents.uploadedByUserId, uploader.id))
    .where(and(...conditions))
    .orderBy(desc(documents.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientDisplayName: r.clientDisplayName,
    status: r.status,
    mimeType: r.mimeType,
    finalAmount: r.finalAmount,
    finalCurrency: canonicalizeCurrency(r.finalCurrency),
    finalDate: r.finalDate,
    finalVendor: r.finalVendor,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    uploadedByDisplayName: uploadedByDisplayLabel(r.uploadedByName),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getDocumentDetailForAccountant(
  accountantUserId: string,
  documentId: string,
): Promise<AccountantDocumentDetail | null> {
  if (!uuidPattern(documentId)) return null;

  const [row] = await db
    .select({
      id: documents.id,
      clientId: documents.clientId,
      clientDisplayName: clients.displayName,
      status: documents.status,
      finalAmount: documents.finalAmount,
      finalCurrency: documents.finalCurrency,
      finalDate: documents.finalDate,
      finalVendor: documents.finalVendor,
      finalInvoiceNumber: documents.finalInvoiceNumber,
      extractedInvoiceNumber: documents.extractedInvoiceNumber,
      clientNote: documents.clientNote,
      extracted: documents.extracted,
      submittedAt: documents.submittedAt,
      mimeType: documents.mimeType,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .where(
      and(eq(documents.id, documentId), eq(clients.accountantId, accountantUserId)),
    )
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    clientId: row.clientId,
    clientDisplayName: row.clientDisplayName,
    status: row.status,
    finalAmount: row.finalAmount,
    finalCurrency: canonicalizeCurrency(row.finalCurrency),
    finalDate: row.finalDate,
    finalVendor: row.finalVendor,
    finalInvoiceNumber: row.finalInvoiceNumber,
    extractedInvoiceNumber: row.extractedInvoiceNumber,
    clientNote: row.clientNote,
    extracted: row.extracted,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    mimeType: row.mimeType,
  };
}

/** למסלול הורדה פנימי — כולל storageObjectKey לאימות מאגר מקומי */
export async function getDocumentStorageForAccountant(
  accountantUserId: string,
  documentId: string,
): Promise<{
  id: string;
  mimeType: string;
  storageObjectKey: string;
} | null> {
  if (!uuidPattern(documentId)) return null;
  const [row] = await db
    .select({
      id: documents.id,
      mimeType: documents.mimeType,
      storageObjectKey: documents.storageObjectKey,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .where(
      and(eq(documents.id, documentId), eq(clients.accountantId, accountantUserId)),
    )
    .limit(1);
  return row ?? null;
}

export type AccountantDocumentDeletionContext = {
  id: string;
  clientId: string;
  storageObjectKey: string;
  status: string;
};

/** הרשאה למחיקה ע״י רו״ח — המסמך שייך ללקוח שלו בלבד */
export async function getDocumentDeletionContextForAccountant(
  accountantUserId: string,
  documentId: string,
): Promise<AccountantDocumentDeletionContext | null> {
  if (!uuidPattern(documentId)) return null;
  const [row] = await db
    .select({
      id: documents.id,
      clientId: documents.clientId,
      storageObjectKey: documents.storageObjectKey,
      status: documents.status,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .where(
      and(eq(documents.id, documentId), eq(clients.accountantId, accountantUserId)),
    )
    .limit(1);
  return row ?? null;
}
