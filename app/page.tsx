import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          פלטפורמת קבלות וחשבוניות
        </h1>
        <p className="mt-3 text-zinc-600">
          לקוחות מעלים מסמכים, רואה החשבון מקבל התראות ומסנן — לפי התכנון ב-
          <code className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
            docs/
          </code>
          .
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/login"
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          התחברות
        </Link>
      <p className="max-w-md text-center text-xs text-zinc-500">
        תיעוד: תיקיית <code className="rounded bg-zinc-100 px-1">docs/</code> בפרויקט.
      </p>
      </div>
    </div>
  );
}
