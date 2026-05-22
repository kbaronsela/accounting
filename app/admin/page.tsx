import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import { listAccountantsWithClientCounts } from "@/lib/admin/accountants-queries";
import { AdminWorkspace } from "./admin-workspace";

export default async function AdminHomePage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const initialAccountants = await listAccountantsWithClientCounts();

  return (
    <AdminWorkspace
      initialAccountants={initialAccountants}
      showAccountantLink={hasRole(roles, "accountant")}
      showClientLink={hasRole(roles, "client")}
    />
  );
}
