import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-4 py-12 sm:gap-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          פלטפורמת קבלות וחשבוניות
        </h1>
        <p className="mt-3 text-sm text-zinc-600 sm:text-base">
          לקוחות מעלים מסמכים, רואה החשבון מקבל התראות ומסנן — לפי התכנון ב-
          <code className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
            docs/
          </code>
          .
        </p>
      </div>
      <Link
        href="/login"
        className="w-full max-w-[16rem] rounded-full bg-zinc-900 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
      >
        התחברות
      </Link>
      <p className="mx-auto max-w-md text-center text-xs text-zinc-500">
        תיעוד: תיקיית{" "}
        <code className="rounded bg-zinc-100 px-1">docs/</code> בפרויקט.
      </p>
    </div>
  );
}
