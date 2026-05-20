import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

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
      <header className="border-b border-zinc-200 bg-white px-4 py-2">
        <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 text-sm text-zinc-600">
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
        </nav>
      </header>
      {children}
    </div>
  );
}
