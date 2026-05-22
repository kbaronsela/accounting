import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { getClientMe, listDocumentsForClientUser } from "@/lib/client/queries";
import { ClientWorkspace } from "./client-workspace";

export default async function ClientHomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/client");
  }

  const me = await getClientMe(session.user.id);
  if (!me) {
    redirect("/login?callbackUrl=/client");
  }

  const docsResult = await listDocumentsForClientUser(session.user.id, {
    limit: 25,
  });
  const documents = docsResult.ok ? docsResult.items : [];

  const greetingName =
    me.user.name?.trim() ||
    me.user.email?.split("@")[0] ||
    "משתמש";

  const roles = session.user.roles ?? [];

  return (
    <ClientWorkspace
      greetingName={greetingName}
      clients={me.clients}
      documents={documents}
      showAdminLink={hasRole(roles, "admin")}
      showAccountantLink={hasRole(roles, "accountant")}
    />
  );
}
