"use client";

import { useState } from "react";
import {
  ClientDocumentsList,
  ClientDocumentsListMobileSortBar,
  DEFAULT_DOCUMENTS_LIST_SORT,
} from "./client-documents-list";
import { ClientPortalShell } from "./client-portal-shell";
import { ClientUploadSection } from "./client-upload-section";
import type { ClientDocumentListItem, ClientMeClientRow } from "@/lib/client/queries";

export function ClientWorkspace({
  greetingName,
  clients,
  documents,
  showAdminLink,
  showAccountantLink,
}: {
  greetingName: string;
  clients: ClientMeClientRow[];
  documents: ClientDocumentListItem[];
  showAdminLink: boolean;
  showAccountantLink: boolean;
}) {
  const [documentsSort, setDocumentsSort] = useState(DEFAULT_DOCUMENTS_LIST_SORT);

  return (
    <ClientPortalShell
      showAdminLink={showAdminLink}
      showAccountantLink={showAccountantLink}
    >
      <div className="w-full max-w-3xl space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
            שלום, {greetingName}
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            כאן ניתן להעלות מסמכים ולערוך את שנדרש מהם מתוך דף המסמך,
            עד לאישור על ידי רואה החשבון.
          </p>
        </div>

        <ClientUploadSection clients={clients} />

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h2 className="text-base font-semibold text-zinc-900">
              מסמכים אחרונים
            </h2>
            {documents.length > 0 ? (
              <ClientDocumentsListMobileSortBar
                sort={documentsSort}
                onSortChange={setDocumentsSort}
              />
            ) : null}
          </div>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              אין עדיין מסמכים. ניתן להעלות קובץ למעלה.
            </p>
          ) : (
            <ClientDocumentsList
              documents={documents}
              sort={documentsSort}
              onSortChange={setDocumentsSort}
            />
          )}
        </section>
      </div>
    </ClientPortalShell>
  );
}
