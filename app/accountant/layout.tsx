import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

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
      <header className="border-b border-zinc-200 bg-white px-4 py-2">
        <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 text-sm text-zinc-600">
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
        </nav>
      </header>
      {children}
    </div>
  );
}
