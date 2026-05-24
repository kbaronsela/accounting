/**
 * מריץ מיגרציות Drizzle עם הדפת שגיאות מלאה לטרמינל
 * (drizzle-kit לפעמים יוצא עם קוד 1 בלי להדפיס את הסיבה).
 */
const path = require("path");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  override: true,
});
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

/** מהמחשב המקומי: נסו Postgres TCP ציבורי מ‑Railway. ראו DATABASE_MIGRATE_URL ב‑.env.example */
const url =
  process.env.DATABASE_MIGRATE_URL?.trim() ||
  process.env.DATABASE_PUBLIC_URL?.trim() ||
  process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(
    "חסר connection string למסד: הגדירו DATABASE_URL או DATABASE_MIGRATE_URL ב־.env.local",
  );
  process.exit(1);
}

try {
  const h = new URL(url).hostname;
  if (/\.railway\.internal$/i.test(h)) {
    console.warn(
      `\n⚠ ה־URL מצביע על ${h} — זה DNS פנימי של Railway. מהמחשב הביתי זה לא יעבוד (ENOTFOUND).\n` +
        "  • בשרות Postgres של Railway פתחו Connect / משתנה מסוג התחברות ציבורית (TCP proxy).\n" +
        "  • שמו את כתובת ה־connection ב־DATABASE_MIGRATE_URL ב־.env.local (לא לפרסם).\n" +
        "  • אלטרנטיבה: מתוך Shell של פריסת Railway הריצו שם את npm run db:migrate עם DATABASE_URL הפנימי.\n",
    );
  }
} catch {
  /* URL לא בסגנון http(s)—נתפרש לְpg connection string הרגיל */
}

const migrationsFolder = path.join(__dirname, "..", "lib", "db", "migrations");

async function main() {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  try {
    console.log("DATABASE_URL → מסד:", maskUrl(url));
    console.log("תיקיית מיגרציות:", migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log("מיגרציות הוחלו בהצלחה.");
  } catch (err) {
    console.error("כשל בהחלת מיגרציות:");
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function maskUrl(u) {
  try {
    const x = new URL(u);
    if (x.password) x.password = "***";
    if (x.username) x.username = "***";
    return x.toString();
  } catch {
    return "(מחרוזת לא תקינה)";
  }
}

main();
