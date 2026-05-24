import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasRole } from "@/lib/auth/roles";
import { getClientMe } from "@/lib/client/queries";
import { peekShareStagingMeta } from "@/lib/uploads/share-target-staging";
import { ShareFinishForm } from "./share-finish-form";
import Link from "next/link";

const SID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams?: Promise<{ sid?: string | string[] | undefined }>;
};

export default async function ClientShareFinishPage(props: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/client");
  }
  if (!hasRole(session.user.roles, "client")) {
    redirect("/client");
  }

  const params = props.searchParams ? await props.searchParams : {};
  const rawSid =
    typeof params.sid === "string"
      ? params.sid.trim()
      : Array.isArray(params.sid)
        ? params.sid[0]?.trim() ?? ""
        : "";

  if (!rawSid || !SID_REGEX.test(rawSid)) {
    redirect("/client");
  }

  const me = await getClientMe(session.user.id);
  if (!me || me.clients.length < 2) {
    redirect("/client");
  }

  const meta = await peekShareStagingMeta(session.user.id, rawSid);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-5" dir="rtl">
      <h1 className="text-lg font-semibold text-zinc-900">
        השלמת שיתוף מסמך
      </h1>
      {meta ? (
        <>
          <p className="text-sm text-zinc-700">
            בחר באיזה תיק לשמור את הקבלה מהשיתוף. ההעלאה תתחיל מיד עם לחיצה על
            הכפתור.
          </p>
          <ShareFinishForm
            stagingId={rawSid}
            clients={me.clients}
            suggestedFileName={meta.suggestedName}
          />
        </>
      ) : (
        <>
          <p className="text-sm text-red-900">
            הקישור לא בתוקף או שפג התוקף של הקובץ המאוחסן (למשל לאחר מעל רבע שעה).
            נסו שיתוף שוב מתוך המייל או וואטסאפ לתוך האפליקציה.
          </p>
          <Link
            href="/client"
            className="text-sm font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900"
          >
            חזרה לאזור הלקוח
          </Link>
        </>
      )}
    </div>
  );
}
