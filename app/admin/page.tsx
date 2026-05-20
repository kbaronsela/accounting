import { InviteAccountantForm } from "./invite-accountant-form";
import { SignOutButton } from "./sign-out-button";

export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      <InviteAccountantForm />
      <div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">שלום, אדמין</h1>
        <p className="mt-2 text-sm text-zinc-600">
          אזור זה מוגן. בשלבים הבאים: ניהול רואי חשבון מלא והזמנות לקוח לפי
          התכנון ב-
          <code className="mx-1 rounded bg-zinc-100 px-1.5 text-xs">docs/</code>
          .
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
