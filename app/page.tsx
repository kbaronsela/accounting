import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-4 py-12 sm:gap-10 sm:px-6 sm:py-16">
      <h1 className="mx-auto max-w-lg text-center text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
        פלטפורמת קבלות וחשבוניות
      </h1>
      <Link
        href="/login"
        className="w-full max-w-[16rem] rounded-full bg-zinc-900 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
      >
        התחברות
      </Link>
    </div>
  );
}
