import type pg from "pg";

let inflight: Promise<void> | null = null;

/**
 * מבטיחה שטבלת user_role קיימת (מקביל ל־0001_multi_role).
 * - בפיתוח: יוצרת טבלה, מעתיקה מ־user.role אם העמודה עדיין קיימת, מוחקת את העמודה.
 * - בפרודקשן: זורקת שגיאה עם הוראה להריץ db:migrate.
 */
export async function ensureUserRoleTable(pool: pg.Pool): Promise<void> {
  if (!inflight) {
    inflight = runEnsure(pool).finally(() => {
      inflight = null;
    });
  }
  await inflight;
}

async function runEnsure(pool: pg.Pool): Promise<void> {
  const { rows } = await pool.query<{ reg: string | null }>(
    "SELECT to_regclass('public.user_role') AS reg",
  );
  if (rows[0]?.reg != null) {
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      'חסרה טבלת "user_role" במסד הנתונים. הריצי בשרת: npm run db:migrate',
    );
  }

  const client = await pool.connect();
  try {
    console.warn(
      '[db] טבלת user_role חסרה — נוצרת אוטומטית (פיתוח). בפרודקשן: הריצי "npm run db:migrate"',
    );
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE "user_role" (
        "userId" text NOT NULL,
        "role" text NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "user_role_userId_role_pk" PRIMARY KEY("userId","role")
      )
    `);
    await client.query(`
      ALTER TABLE "user_role"
      ADD CONSTRAINT "user_role_userId_user_id_fk"
      FOREIGN KEY ("userId") REFERENCES "public"."user"("id")
      ON DELETE cascade ON UPDATE no action
    `);
    const colCheck = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'role'
      LIMIT 1
    `);
    if (colCheck.rowCount && colCheck.rowCount > 0) {
      await client.query(`
        INSERT INTO "user_role" ("userId", "role", "createdAt")
        SELECT "id", "role", NOW() FROM "user" WHERE "role" IS NOT NULL
      `);
      await client.query(`ALTER TABLE "user" DROP COLUMN "role"`);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
