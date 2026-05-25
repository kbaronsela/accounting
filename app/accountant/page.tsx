import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import {
  AccountantWorkspace,
  type AccountantWorkspaceSection,
} from "./accountant-workspace";

type AccountantPageProps = {
  searchParams?: Promise<{ section?: string | string[] | undefined }>;
};

export default async function AccountantHomePage({
  searchParams,
}: AccountantPageProps) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];

  let initialSection: AccountantWorkspaceSection = "documents";
  if (searchParams) {
    const sp = await searchParams;
    const raw = sp.section;
    const one = Array.isArray(raw) ? raw[0] : raw;
    if (one === "clients") {
      initialSection = "clients";
    } else if (one === "reports") {
      initialSection = "reports";
    }
  }

  return (
    <AccountantWorkspace
      initialSection={initialSection}
      showAdminLink={hasRole(roles, "admin")}
      showClientLink={hasRole(roles, "client")}
    />
  );
}
