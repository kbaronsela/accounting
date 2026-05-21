import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { defaultHomePath } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ChangePasswordForm } from "./change-password-form";

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
  const defaultReturnHref = defaultHomePath(session.user.roles ?? []);

  return (
    <div className="mx-auto max-w-xl px-3 py-8 sm:px-4">
      <ChangePasswordForm
        hasExistingPassword={hasExistingPassword}
        defaultReturnHref={defaultReturnHref}
      />
    </div>
  );
}
