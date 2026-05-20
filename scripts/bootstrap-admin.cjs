/**
 * יוצר / משלים משתמש admin לפיתוח (אידמפוטנטי).
 * דורש ב-.env.local: DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD
 *
 * - אם המייל כבר רשום עם admin וסיסמה — לא משנה כלום.
 * - אם המייל רשום בלי סיסמה (למשל נוצר מ-OAuth) או בלי תפקיד admin — משלים.
 * - אחרת יוצר משתמש admin חדש.
 */
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MIN_PASSWORD = 12;

const dbUrl = process.env.DATABASE_URL;
const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";

if (!dbUrl || dbUrl.includes("USER:PASSWORD")) {
  console.error("הגדירי DATABASE_URL תקין ב-.env.local.");
  process.exit(1);
}

if (!email || !email.includes("@")) {
  console.error(
    "הגדירי BOOTSTRAP_ADMIN_EMAIL ב-.env.local (כתובת מייל תקינה).",
  );
  process.exit(1);
}

if (password.length < MIN_PASSWORD) {
  console.error(
    `BOOTSTRAP_ADMIN_PASSWORD חייבת להיות באורך לפחות ${MIN_PASSWORD} תווים.`,
  );
  process.exit(1);
}

/** שמור מסונכרן עם lib/db/ensure-user-role-schema.ts */
async function ensureUserRoleTableExists(client) {
  const { rows } = await client.query(
    "SELECT to_regclass('public.user_role') AS reg",
  );
  if (rows[0]?.reg != null) return;

  console.warn(
    '[db] טבלת user_role חסרה — נוצרת לפני bootstrap. מומלץ גם: npm run db:migrate',
  );
  await client.query("BEGIN");
  try {
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
    if ((colCheck.rowCount ?? 0) > 0) {
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
  }
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await ensureUserRoleTableExists(client);

    const passwordHash = await bcrypt.hash(password, 12);
    const displayName = "Administrator";

    const { rows: emailRow } = await client.query(
      `SELECT u."id", u."passwordHash" FROM "user" u WHERE lower(trim(u."email")) = $1 LIMIT 1`,
      [email],
    );

    if (emailRow.length > 0) {
      const id = emailRow[0].id;
      const hadPassword = Boolean(emailRow[0].passwordHash);

      const { rows: adminForUser } = await client.query(
        `SELECT 1 FROM "user_role" WHERE "userId" = $1 AND "role" = $2 LIMIT 1`,
        [id, "admin"],
      );
      const hasAdmin = adminForUser.length > 0;

      if (hasAdmin && hadPassword) {
        console.log(
          `המשתמש ${email} כבר מוגדר כאדמין עם סיסמה ל־Credentials. לא בוצע שינוי.`,
        );
        return;
      }

      if (!hadPassword) {
        await client.query(
          `UPDATE "user" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
          [passwordHash, id],
        );
      }

      if (!hasAdmin) {
        await client.query(
          `INSERT INTO "user_role" ("userId", "role", "createdAt") VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
          [id, "admin"],
        );
      }

      const auditId = crypto.randomUUID();
      await client.query(
        `INSERT INTO "audit_event" ("id", "actorUserId", "action", "entityType", "entityId", "createdAt")
         VALUES ($1, NULL, $2, $3, $4, NOW())`,
        [auditId, "bootstrap_admin_ensure", "user", id],
      );

      if (!hadPassword) {
        console.log(
          `הוגדרה סיסמה ל־Credentials למשתמש ${email}${!hasAdmin ? " ונוסף תפקיד admin" : ""}.`,
        );
      } else {
        console.log(`נוסף תפקיד admin למשתמש ${email} (הסיסמה לא שונתה).`);
      }
      console.log(
        "מומלץ למחוק או לרוקן את BOOTSTRAP_ADMIN_PASSWORD מ-.env.local אחרי שימוש.",
      );
      return;
    }

    const id = crypto.randomUUID();

    await client.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "passwordHash", "locale", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), NOW())`,
      [id, displayName, email, passwordHash, "he"],
    );

    await client.query(
      `INSERT INTO "user_role" ("userId", "role", "createdAt") VALUES ($1, $2, NOW())`,
      [id, "admin"],
    );

    const auditId = crypto.randomUUID();
    await client.query(
      `INSERT INTO "audit_event" ("id", "actorUserId", "action", "entityType", "entityId", "createdAt")
       VALUES ($1, NULL, $2, $3, $4, NOW())`,
      [auditId, "bootstrap_admin_created", "user", id],
    );

    console.log(`נוצר admin: ${email} (id: ${id}).`);
    console.log(
      "מומלץ למחוק או לרוקן את BOOTSTRAP_ADMIN_PASSWORD מ-.env.local אחרי שימוש.",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
