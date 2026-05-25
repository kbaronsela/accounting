import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasRole } from "@/lib/auth/roles";
import { listAccountantsClientsOwnedForShare } from "@/lib/accountant/list-accountant-share-clients";
import { peekShareStagingMeta } from "@/lib/uploads/share-target-staging";
import { AccountantShareFinishForm } from "./accountant-share-finish-form";
import Link from "next/link";

const SID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams?: Promise<{ sid?: string | string[] | undefined }>;
};

export default async function AccountantShareFinishPage(props: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/accountant");
  }
  if (!hasRole(session.user.roles, "accountant")) {
    redirect("/accountant");
  }

  const params = props.searchParams ? await props.searchParams : {};
  const rawSid =
    typeof params.sid === "string"
      ? params.sid.trim()
      : Array.isArray(params.sid)
        ? params.sid[0]?.trim() ?? ""
        : "";

  if (!rawSid || !SID_REGEX.test(rawSid)) {
    redirect("/accountant");
  }

  const ownedClients = await listAccountantsClientsOwnedForShare(
    session.user.id,
  );

  const meta = await peekShareStagingMeta(session.user.id, rawSid);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-5" dir="rtl">
      <h1 className="text-lg font-semibold text-zinc-900">
        השלמת שיתוף מסמך (רואה חשבון)
      </h1>
      {meta ? (
        ownedClients.length === 0 ? (
          <>
            <p className="text-sm text-zinc-700">
              אין לך תיקי לקוחות במערכת — צרף לקוח לפני שיתוף מסמכים.
            </p>
            <Link
              href="/accountant?section=clients"
              className="text-sm font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900"
            >
              ניהול לקוחות
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-700">
              בחר לאיזה לקוח לשמור את הקבלה מהשיתוף. ההעלאה תתחיל מיד עם
              לחיצה על הכפתור.
            </p>
            <AccountantShareFinishForm
              stagingId={rawSid}
              clients={ownedClients}
              suggestedFileName={meta.suggestedName}
            />
          </>
        )
      ) : (
        <>
          <p className="text-sm text-red-900">
            הקישור לא בתוקף או שפג התוקף של הקובץ המאוחסן (למשל לאחר מעל רבע
            שעה). נסו לשתף שוב מתוך הגלריה או הווטסאפ לתוך האפליקציה.
          </p>
          <Link
            href="/accountant"
            className="text-sm font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900"
          >
            חזרה לאזור רואה החשבון
          </Link>
        </>
      )}
    </div>
  );
}
