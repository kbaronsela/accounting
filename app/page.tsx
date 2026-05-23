import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12 sm:gap-12 sm:px-6 sm:py-20">
      <div
        className="pointer-events-none absolute inset-x-6 top-[12%] h-72 max-w-xl rounded-[3rem] bg-gradient-to-bl from-teal-200/60 via-emerald-100/50 to-transparent blur-2xl sm:inset-x-auto sm:w-[min(36rem,calc(100vw-4rem))]"
        aria-hidden
      />
      <div className="relative z-[1] flex max-w-xl flex-col items-center gap-4 text-center sm:gap-5">
        <p className="text-sm font-medium tracking-wide text-teal-800/90">
          שיתוף קבלות וחשבוניות לעסק
        </p>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl md:text-[2rem]">
          פלטפורמת קבלות וחשבוניות
        </h1>
        <p className="max-w-md text-pretty text-sm leading-relaxed text-zinc-600 sm:text-[0.9375rem]">
          עבודה מסודרת מול רואה חשבון — העלאות, ארגון מסמכים ומעקב, בממשק שנעים להשתמש בו מהמובייל
          ובמחשב.
        </p>
      </div>
      <Link
        href="/login"
        className="relative z-[1] w-full max-w-[16rem] rounded-full bg-gradient-to-bl from-teal-700 to-emerald-900 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-teal-900/25 transition hover:from-teal-800 hover:to-emerald-950 active:scale-[0.98] sm:w-auto"
      >
        התחברות
      </Link>
    </div>
  );
}
