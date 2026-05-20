/**
 * יוצר את מסד הנתונים שמופיע ב-DATABASE_URL (שם אחרי הסלאש האחרון),
 * מתוך התחברות למסד ברירת המחדל `postgres`.
 *
 * דרישה: ב-.env.local להחליף את USER:PASSWORD בפרטים אמיתיים.
 */
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const raw = process.env.DATABASE_URL;

if (!raw || raw.includes("USER:PASSWORD")) {
  console.error(
    "עדכני את DATABASE_URL ב-.env.local: החליפי USER:PASSWORD במשתמש ובסיסמה של PostgreSQL (בדרך כלל משתמש postgres).",
  );
  process.exit(1);
}

let targetUrl;
try {
  targetUrl = new URL(raw);
} catch {
  console.error("DATABASE_URL לא בפורמט תקין.");
  process.exit(1);
}

const dbName = decodeURIComponent(
  targetUrl.pathname.replace(/^\//, "").split("?")[0] || "",
);

if (!dbName) {
  console.error("ב-DATABASE_URL חסר שם מסד (למשל .../accounting).");
  process.exit(1);
}

if (dbName === "postgres") {
  console.error(
    'שם המסד ב-URL הוא "postgres" — שימי שם יעד אחר (למשל accounting) כדי ליצור מסד חדש.',
  );
  process.exit(1);
}

async function main() {
  const adminUrl = new URL(raw);
  adminUrl.pathname = "/postgres";

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (rows.length > 0) {
      console.log(`המסד "${dbName}" כבר קיים.`);
      return;
    }

    const safe = dbName.replace(/"/g, '""');
    await client.query(`CREATE DATABASE "${safe}"`);
    console.log(`נוצר המסד "${dbName}".`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
