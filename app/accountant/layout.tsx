import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "../admin/sign-out-button";

export default async function AccountantLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/accountant");
  }

  const roles = session.user.roles;

  if (!hasRole(roles, "accountant")) {
    if (hasRole(roles, "admin")) {
      redirect("/admin");
    }
    if (hasRole(roles, "client")) {
      redirect("/client");
    }
    redirect("/login?error=forbidden");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white px-3 py-2 sm:px-4">
        <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm text-zinc-600">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/settings/password" className="text-blue-700 hover:underline">
              סיסמה
            </Link>
            {hasRole(roles, "admin") ? (
              <Link href="/admin" className="text-blue-700 hover:underline">
                אדמין
              </Link>
            ) : null}
            {hasRole(roles, "client") ? (
              <Link href="/client" className="text-blue-700 hover:underline">
                לקוח
              </Link>
            ) : null}
          </div>
          <div className="shrink-0">
            <SignOutButton />
          </div>
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
