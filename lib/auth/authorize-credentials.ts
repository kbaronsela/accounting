import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** נקרא רק ב-Route Handler (Node) — לא ב-Edge/middleware */
export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password", unknown>> | undefined,
) {
  const isDev = process.env.NODE_ENV === "development";
  if (!credentials?.email || !credentials?.password) {
    if (isDev) {
      console.warn("[auth] credentials: חסר אימייל או סיסמה");
    }
    return null;
  }
  const email = String(credentials.email).toLowerCase().trim();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    if (isDev) {
      console.warn(`[auth] credentials: אין משתמש עם המייל ${email}`);
    }
    return null;
  }
  if (!user.passwordHash) {
    if (isDev) {
      console.warn(
        `[auth] credentials: למשתמש ${email} אין passwordHash (למשל רק OAuth). יש להריץ npm run db:bootstrap-admin עם אותו מייל.`,
      );
    }
    return null;
  }
  const valid = await compare(
    String(credentials.password),
    user.passwordHash,
  );
  if (!valid) {
    if (isDev) {
      console.warn(`[auth] credentials: סיסמה לא תואמת עבור ${email}`);
    }
    return null;
  }
  return {
    id: user.id,
    email: user.email ?? email,
    name: user.name,
    image: user.image,
  };
}
