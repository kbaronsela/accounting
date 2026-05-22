import { LoginFooterLink, LoginForm } from "./login-form";
import { auth } from "@/auth";
import { defaultHomePath } from "@/lib/auth/roles";
import { redirect } from "next/navigation";

/** משתני סביבה (Railway וכו׳) מתעדכנים בפריסה — לא לקבע כפתור Google לפי זמן build */
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect(defaultHomePath(session.user.roles ?? []));
  }

  const googleOAuthEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-3 py-8 sm:gap-8 sm:px-4 sm:py-12">
      <h1 className="text-center text-xl font-semibold text-zinc-900">התחברות</h1>
      <LoginForm googleOAuthEnabled={googleOAuthEnabled} />
      <LoginFooterLink />
    </div>
  );
}
