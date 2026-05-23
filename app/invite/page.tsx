import type { Metadata } from "next";
import Link from "next/link";
import { InviteFlow } from "./invite-flow";

export const metadata: Metadata = {
  title: "השלמת הזמנה",
  robots: { index: false, follow: false },
};

export default function InvitePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-3 py-8 sm:min-h-screen sm:px-4 sm:py-12">
      <InviteFlow />
      <Link
        href="/login"
        className="mt-8 rounded-xl px-3 py-2 text-sm font-semibold text-teal-800 underline-offset-4 hover:bg-teal-50/70 hover:text-teal-950 hover:underline"
      >
        כבר רשומים? התחברות
      </Link>
    </div>
  );
}
