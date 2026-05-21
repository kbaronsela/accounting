import { LoginFooterLink, LoginForm } from "./login-form";

export default function LoginPage() {
  const googleOAuthEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-3 py-8 sm:gap-8 sm:px-4 sm:py-12">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-zinc-900">התחברות</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-600">
          הזיני אימייל וסיסמה
          {googleOAuthEnabled ? " או עם Google." : "."} אחרי הכניסה אפשר
          לשנות או להגדיר סיסמה דרך הקישור «סיסמה» בתפריט העליון.
        </p>
      </div>
      <LoginForm googleOAuthEnabled={googleOAuthEnabled} />
      <LoginFooterLink />
    </div>
  );
}
