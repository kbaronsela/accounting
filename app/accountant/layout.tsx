import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
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

  return <div className="flex min-h-full flex-col">{children}</div>;
}
