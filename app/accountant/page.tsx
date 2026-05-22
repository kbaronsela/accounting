import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import { AccountantWorkspace } from "./accountant-workspace";

export default async function AccountantHomePage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  return (
    <AccountantWorkspace
      showAdminLink={hasRole(roles, "admin")}
      showClientLink={hasRole(roles, "client")}
    />
  );
}
