import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  const roles = session.user.roles;

  if (!hasRole(roles, "admin")) {
    if (hasRole(roles, "accountant")) {
      redirect("/accountant");
    }
    if (hasRole(roles, "client")) {
      redirect("/client");
    }
    redirect("/login?error=forbidden");
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-50" dir="rtl">
      <header className="border-b border-zinc-200 bg-white px-3 py-2 sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Link
            href="/admin"
            className="text-sm font-semibold text-zinc-900 hover:text-zinc-700"
          >
            אזור אדמין
          </Link>
          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
            <Link
              href="/settings/password"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              סיסמה
            </Link>
            {hasRole(roles, "accountant") ? (
              <Link
                href="/accountant"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                רואה חשבון
              </Link>
            ) : null}
            {hasRole(roles, "client") ? (
              <Link
                href="/client"
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                לקוח
              </Link>
            ) : null}
            <span className="truncate" title={session.user.email ?? undefined}>
              {session.user.email}
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-4 text-start sm:px-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
