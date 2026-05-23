import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ChangePasswordForm } from "./change-password-form";
import {
  PasswordSettingsChrome,
  type PasswordSettingsWorkspace,
} from "./password-settings-chrome";

export const metadata = {
  title: "סיסמה",
};

export default async function PasswordSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/settings/password");
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const hasExistingPassword = Boolean(user?.passwordHash);
  const roles = session.user.roles ?? [];

  const workspace: PasswordSettingsWorkspace = hasRole(roles, "admin")
    ? "admin"
    : hasRole(roles, "accountant")
      ? "accountant"
      : "client";

  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <PasswordSettingsChrome
        workspace={workspace}
        showAdminLink={hasRole(roles, "admin")}
        showAccountantLink={hasRole(roles, "accountant")}
        showClientLinkToWorkspace={hasRole(roles, "client")}
      >
        <div className="mx-auto w-full max-w-xl">
          <ChangePasswordForm hasExistingPassword={hasExistingPassword} />
        </div>
      </PasswordSettingsChrome>
    </div>
  );
}
