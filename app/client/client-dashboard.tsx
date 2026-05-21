"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ClientDocumentsList,
  ClientDocumentsListMobileSortBar,
  DEFAULT_DOCUMENTS_LIST_SORT,
} from "./client-documents-list";
import { ClientUploadSection } from "./client-upload-section";
import type { ClientDocumentListItem, ClientMeClientRow } from "@/lib/client/queries";

type Props = {
  greetingName: string;
  email: string | null;
  clients: ClientMeClientRow[];
  documents: ClientDocumentListItem[];
};

export function ClientDashboard({
  greetingName,
  email,
  clients,
  documents,
}: Props) {
  const [documentsSort, setDocumentsSort] = useState(DEFAULT_DOCUMENTS_LIST_SORT);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 py-6 sm:space-y-10 sm:px-4 sm:py-10" dir="rtl">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
          שלום, {greetingName}
        </h1>
        {email ? (
          <p className="mt-1 text-sm text-zinc-600">{email}</p>
        ) : null}
        <p className="mt-3 text-sm text-zinc-600">
          כאן ניתן להעלות מסמכים ולערוך פרטים לפני שליחה לרואה החשבון מדף המסמך.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm text-blue-700 underline-offset-4 hover:underline"
        >
          דף הבית
        </Link>
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
  );
}
