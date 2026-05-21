import Link from "next/link";
import { AccountantClientsPanel } from "./accountant-clients-panel";
import { AccountantDocumentsPanel } from "./accountant-documents-panel";

export default function AccountantHomePage() {
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-3 py-6 sm:gap-8 sm:px-4 sm:py-12" dir="rtl">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">אזור רואה חשבון</h1>
        <p className="mt-2 text-sm text-zinc-600">
          מסמכים מהלקוחות ותיקי לקוח — לפי המפרט ב־<code className="mx-1 rounded bg-zinc-100 px-1.5 text-xs">docs/api.md</code>.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm text-blue-700 underline-offset-4 hover:underline"
        >
          דף הבית
        </Link>
      </div>
      <AccountantDocumentsPanel />
      <AccountantClientsPanel />
    </div>
  );
}
