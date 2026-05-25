import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { hasRole } from "@/lib/auth/roles";
import { listDocumentsForAccountant } from "@/lib/accountant/documents-queries";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parsePositiveInt(s: string | null, fallback: number): number {
  if (!s?.trim()) return fallback;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "accountant")) {
    return jsonError(403, "FORBIDDEN", "נדרשת הרשאת רואה חשבון.");
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId")?.trim();
  if (clientId && !isUuid(clientId)) {
    return jsonError(400, "VALIDATION_ERROR", "פרמטר clientId אינו UUID תקין.");
  }

  const status = searchParams.get("status")?.trim() ?? null;
  const from = searchParams.get("from")?.trim() ?? null;
  const to = searchParams.get("to")?.trim() ?? null;
  const invoiceFrom = searchParams.get("invoiceFrom")?.trim() ?? null;
  const invoiceTo = searchParams.get("invoiceTo")?.trim() ?? null;

  const isoDay = /^\d{4}-\d{2}-\d{2}$/;
  if (invoiceFrom && !isoDay.test(invoiceFrom)) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "invoiceFrom חייב להיות בתבנית YYYY-MM-DD.",
    );
  }
  if (invoiceTo && !isoDay.test(invoiceTo)) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "invoiceTo חייב להיות בתבנית YYYY-MM-DD.",
    );
  }
  const limitRaw = parsePositiveInt(searchParams.get("limit"), 50);
  const limit = Math.min(Math.max(limitRaw, 1), 2000);

  let minAmount: number | null = null;
  let maxAmount: number | null = null;
  const minRaw = searchParams.get("minAmount");
  const maxRaw = searchParams.get("maxAmount");
  if (minRaw) {
    const n = Number.parseFloat(minRaw);
    if (!Number.isFinite(n)) {
      return jsonError(400, "VALIDATION_ERROR", "minAmount אינו מספר תקין.");
    }
    minAmount = n;
  }
  if (maxRaw) {
    const n = Number.parseFloat(maxRaw);
    if (!Number.isFinite(n)) {
      return jsonError(400, "VALIDATION_ERROR", "maxAmount אינו מספר תקין.");
    }
    maxAmount = n;
  }

  const items = await listDocumentsForAccountant(session.user.id, {
    clientId: clientId || null,
    status,
    fromSubmittedDate: from || null,
    toSubmittedDate: to || null,
    fromInvoiceDate: invoiceFrom || null,
    toInvoiceDate: invoiceTo || null,
    minAmount,
    maxAmount,
    limit,
  });

  return Response.json({
    items,
    nextCursor: null,
  });
}
