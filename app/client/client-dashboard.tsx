import Link from "next/link";
import { DraftUploadResumeButton } from "./draft-upload-resume-button";
import { ClientUploadSection } from "./client-upload-section";
import type { ClientDocumentListItem, ClientMeClientRow } from "@/lib/client/queries";

const STATUS_LABELS: Record<string, string> = {
  draft_uploading: "טעינת קובץ",
  uploaded: "הועלה",
  ocr_processing: "עיבוד OCR",
  needs_review: "דורש בדיקה",
  ocr_failed: "כשל ב־OCR",
  ready_to_submit: "מוכן לשליחה",
  submitted: "נשלח לרואה החשבון",
  rejected_quality: "נדחה (איכות)",
  archived: "בארכיון",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

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
          כאן מרוכזים התיקים, העלאת מסמכים, ופרטים לפני שליחה לרואה החשבון מדף המסמך.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm text-blue-700 underline-offset-4 hover:underline"
        >
          דף הבית
        </Link>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-zinc-900">התיקים שלי</h2>
        {clients.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            עדיין לא שוייכת לתיק. אם קיבלת הזמנה — השלימי הרשמה מקישור ההזמנה.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
            {clients.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3"
              >
                <span className="font-medium text-zinc-900">
                  {c.displayName}
                </span>
                <span className="text-xs text-zinc-500">
                  {c.role === "primary" ? "ראשי תיק" : "חבר בתיק"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ClientUploadSection clients={clients} />

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-zinc-900">
          מסמכים אחרונים
        </h2>
        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            אין עדיין מסמכים. ניתן להעלות קובץ למעלה.
          </p>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-zinc-200 md:hidden">
              {documents.map((d) => (
                <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="font-medium text-zinc-900">
                    {d.clientDisplayName}
                  </div>
                  <dl className="mt-2 space-y-1.5 text-sm text-zinc-600">
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                      <dt className="text-zinc-500">סטטוס</dt>
                      <dd>{statusLabel(d.status)}</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                      <dt className="text-zinc-500">סכום</dt>
                      <dd>
                        {d.finalAmount
                          ? `${d.finalAmount}${d.finalCurrency ? ` ${d.finalCurrency}` : ""}`
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                      <dt className="text-zinc-500">עודכן</dt>
                      <dd className="tabular-nums">
                        {new Date(d.updatedAt).toLocaleString("he-IL", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    href={`/client/documents/${d.id}`}
                    className="mt-3 inline-flex text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
                  >
                    פרטים / הגשה
                  </Link>
                  {d.status === "draft_uploading" ? (
                    <div className="mt-3">
                      <DraftUploadResumeButton documentId={d.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[36rem] text-right text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="pb-2 font-medium">תיק</th>
                  <th className="pb-2 font-medium">סטטוס</th>
                  <th className="pb-2 font-medium">סכום</th>
                  <th className="pb-2 font-medium">עודכן</th>
                  <th className="pb-2 font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {documents.map((d) => (
                  <tr key={d.id} className="text-zinc-800">
                    <td className="py-2.5 font-medium text-zinc-900">
                      {d.clientDisplayName}
                    </td>
                    <td className="py-2.5 text-zinc-600">
                      {statusLabel(d.status)}
                    </td>
                    <td className="py-2.5 text-zinc-600">
                      {d.finalAmount
                        ? `${d.finalAmount}${d.finalCurrency ? ` ${d.finalCurrency}` : ""}`
                        : "—"}
                    </td>
                    <td className="py-2.5 whitespace-nowrap text-zinc-500">
                      {new Date(d.updatedAt).toLocaleString("he-IL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/client/documents/${d.id}`}
                          className="text-sm text-blue-700 underline-offset-4 hover:underline"
                        >
                          פרטים / הגשה
                        </Link>
                        {d.status === "draft_uploading" ? (
                          <DraftUploadResumeButton documentId={d.id} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
