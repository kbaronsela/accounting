import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
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

  return <div className="flex min-h-full flex-col">{children}</div>;
}
