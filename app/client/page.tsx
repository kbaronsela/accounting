import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ClientDashboard } from "./client-dashboard";
import { getClientMe, listDocumentsForClientUser } from "@/lib/client/queries";

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
    "משתמשת";

  return (
    <ClientDashboard
      greetingName={greetingName}
      email={me.user.email}
      clients={me.clients}
      documents={documents}
    />
  );
}
