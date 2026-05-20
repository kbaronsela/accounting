/**
 * מריץ מיגרציות Drizzle עם הדפת שגיאות מלאה לטרמינל
 * (drizzle-kit לפעמים יוצא עם קוד 1 בלי להדפיס את הסיבה).
 */
const path = require("path");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("חסר DATABASE_URL ב-.env.local");
  process.exit(1);
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
