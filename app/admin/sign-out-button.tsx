"use client";

import { signOut } from "next-auth/react";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  const base =
    "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:opacity-60";
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
