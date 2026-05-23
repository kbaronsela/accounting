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
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-3 py-8 sm:gap-10 sm:px-4 sm:py-14">
      <div
        className="pointer-events-none absolute inset-x-10 top-[8%] h-52 max-w-md rounded-[2.75rem] bg-gradient-to-bl from-teal-200/45 via-transparent to-transparent blur-2xl sm:top-[10%] sm:h-64 sm:max-w-lg"
        aria-hidden
      />
      <div className="relative z-[1] w-full max-w-sm rounded-2xl border border-teal-100/90 bg-white/85 p-6 shadow-xl shadow-teal-900/[0.06] backdrop-blur-sm sm:p-8">
        <h1 className="text-center text-xl font-bold tracking-tight text-zinc-900">התחברות</h1>
        <div className="mt-8">
          <LoginForm googleOAuthEnabled={googleOAuthEnabled} />
        </div>
        <div className="mt-8 border-t border-teal-100/80 pt-6 text-center">
          <LoginFooterLink />
        </div>
      </div>
    </div>
  );
}
