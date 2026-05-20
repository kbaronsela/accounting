import Link from "next/link";

export default function AccountantHomePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-900">אזור רואה חשבון</h1>
      <p className="max-w-md text-center text-sm text-zinc-600">
        כאן יופיע הדשבורד לפי התכנון — בקרוב.
      </p>
      <Link href="/" className="text-sm text-blue-700 underline-offset-4 hover:underline">
        דף הבית
      </Link>
    </div>
  );
}
