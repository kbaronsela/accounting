import { LoginFooterLink, LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-zinc-900">התחברות</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-600">
          הזיני אימייל וסיסמה (כולל חשבון אדמין מ-bootstrap).
        </p>
      </div>
      <LoginForm />
      <LoginFooterLink />
    </div>
  );
}
