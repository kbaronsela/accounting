"use client";

import { signOut } from "next-auth/react";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  const base =
    "rounded-lg bg-gradient-to-bl from-teal-700 to-emerald-900 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-900/20 transition hover:from-teal-800 hover:to-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 disabled:opacity-60";
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.assign("/");
      }}
      className={[base, className].filter(Boolean).join(" ")}
    >
      התנתקות
    </button>
  );
}
