import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ClientDocumentWorkspace } from "./document-workspace";
import { getDocumentForClientMember } from "@/lib/client/document-access";
import { isClientDocumentEditable } from "@/lib/client/document-edit-policy";

type PageProps = { params: Promise<{ documentId: string }> };

export default async function ClientDocumentPage(props: PageProps) {
  const { documentId } = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/client/documents/${documentId}`);
  }

  const doc = await getDocumentForClientMember(session.user.id, documentId);
  if (!doc) {
    notFound();
  }

  const [clRow] = await db
    .select({ displayName: clients.displayName })
    .from(clients)
    .where(eq(clients.id, doc.clientId))
    .limit(1);

  const initial = {
    id: doc.id,
    clientId: doc.clientId,
    clientDisplayName: clRow?.displayName ?? null,
    status: doc.status,
    finalAmount: doc.finalAmount,
    finalCurrency: doc.finalCurrency,
    finalDate: doc.finalDate,
    finalVendor: doc.finalVendor,
    clientNote: doc.clientNote,
    submittedAt: doc.submittedAt?.toISOString() ?? null,
    editable: isClientDocumentEditable(doc.status),
  };

  return (
    <ClientDocumentWorkspace
      key={`${doc.id}-${doc.submittedAt?.toISOString() ?? "nosubmit"}-${doc.updatedAt.toISOString()}`}
      initial={initial}
    />
  );
}
