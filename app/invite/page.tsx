import type { Metadata } from "next";
import Link from "next/link";
import { InviteFlow } from "./invite-flow";

export const metadata: Metadata = {
  title: "השלמת הזמנה",
  robots: { index: false, follow: false },
};

export default function InvitePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-100 px-3 py-8 sm:min-h-screen sm:px-4 sm:py-12">
      <InviteFlow />
      <Link
        href="/login"
        className="mt-6 text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
      >
        כבר רשומים? התחברות
      </Link>
    </div>
  );
}
