import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "../admin/sign-out-button";

export default async function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/client");
  }

  const roles = session.user.roles;

  if (!hasRole(roles, "client")) {
    if (hasRole(roles, "admin")) {
      redirect("/admin");
    }
    if (hasRole(roles, "accountant")) {
      redirect("/accountant");
    }
    redirect("/login?error=forbidden");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white px-3 py-2 sm:px-4">
        <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm text-zinc-600">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-zinc-800">אזור לקוח</span>
            <Link href="/settings/password" className="text-blue-700 hover:underline">
              סיסמה
            </Link>
            {hasRole(roles, "admin") ? (
              <Link href="/admin" className="text-blue-700 hover:underline">
                אדמין
              </Link>
            ) : null}
            {hasRole(roles, "accountant") ? (
              <Link href="/accountant" className="text-blue-700 hover:underline">
                רואה חשבון
              </Link>
            ) : null}
          </div>
          <div className="shrink-0">
            <SignOutButton />
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
