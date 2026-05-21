import { compare, hash as bcryptHash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { jsonError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { z } from "zod";

const MIN_LEN = 12;

const bodySchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(MIN_LEN, `הסיסמה החדשה חייבת לכלול לפחות ${MIN_LEN} תווים.`),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "UNAUTHORIZED", "נדרשת התחברות.");
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "גוף הבקשה אינו JSON תקין.");
  }

  const parsed = bodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(" · ") || "נתונים לא תקינים.";
    return jsonError(422, "VALIDATION_ERROR", msg);
  }

  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return jsonError(404, "NOT_FOUND", "המשתמש לא נמצא.");
  }

  if (user.passwordHash) {
    const pw = currentPassword ?? "";
    if (!pw.trim()) {
      return jsonError(
        422,
        "CURRENT_PASSWORD_REQUIRED",
        "יש להזין את הסיסמה הנוכחית.",
      );
    }
    const match = await compare(pw, user.passwordHash);
    if (!match) {
      return jsonError(
        401,
        "INVALID_PASSWORD",
        "הסיסמה הנוכחית שגויה.",
      );
    }
  }

  const newHash = await bcryptHash(newPassword, 12);

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return Response.json({ ok: true });
}
