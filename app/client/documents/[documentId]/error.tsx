"use client";

import Link from "next/link";

/** מסך שגיאה כשמרנדר צד־שרת של עמוד מסמך נכשל (למשל חריגה בלתי צפויה). */
export default function ClientDocumentWorkspaceError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const digestPart = error.digest ? ` · digest: ${error.digest}` : "";
  const message =
    `${error.message}${digestPart}` || `שגיאה בטעינת המסמך${digestPart}`;

  return (
    <div
      className="mx-auto w-full max-w-xl space-y-4 px-3 py-10 sm:px-4"
      dir="rtl"
    >
      <h1 className="text-lg font-semibold text-zinc-900">לא הצלחנו לטעון מסך זה</h1>
      <p className="text-sm text-zinc-600">
        אירעה בעיה טכנית בשרת בעת הצגת המסמך. נסו לרענן את הדף. אם זה חוזר,
        העתיקו להודעה את הפרט טכני למטה.
      </p>
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 break-words">
        {message}
      </p>
      <Link
        href="/client"
        className="inline-block text-sm font-medium text-teal-800 underline-offset-4 hover:underline"
      >
        חזרה לניהול מסמכים
      </Link>
    </div>
  );
}
