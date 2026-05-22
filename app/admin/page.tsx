import { listAccountantsWithClientCounts } from "@/lib/admin/accountants-queries";
import { InviteAccountantForm } from "./invite-accountant-form";
import { ManageAccountantsPanel } from "./manage-accountants-panel";
import { SignOutButton } from "./sign-out-button";

export default async function AdminHomePage() {
  const initialAccountants = await listAccountantsWithClientCounts();

  return (
    <div className="space-y-6 sm:space-y-8">
      <InviteAccountantForm />
      <ManageAccountantsPanel initialItems={initialAccountants} />
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-8">
        <h1 className="text-lg font-semibold text-zinc-900">שלום, אדמין</h1>
        <p className="mt-2 text-sm text-zinc-600">
          אזור זה מוגן. ניהול רואי החשבון והעברת או מחיקת התיקים שלהם מתבצע מהטבלה
          למעלה. ההזמנות לפי התכנון ב-
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
