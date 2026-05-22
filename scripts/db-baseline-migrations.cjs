/**
 * סימון מיגרציות כ"כבר הוחלו" כשהמסד נוצר מ-db:push / ידנית ואין רשומות ב-drizzle.__drizzle_migrations.
 * אחרי זה: npm run db:migrate יריץ רק את מה שנשאר (למשל 0002).
 *
 * שימוש:
 *   npm run db:baseline
 *   npm run db:baseline -- --up-to 0001_multi_role
 *   npm run db:baseline -- --force  (ממשיך גם אם כבר יש רשומות — זהירות)
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  override: true,
});
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MIGRATIONS_DIR = path.join(__dirname, "..", "lib", "db", "migrations");
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, "meta", "_journal.json");

function parseArgs() {
  const argv = process.argv.slice(2);
  let upTo = "0001_multi_role";
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--up-to" && argv[i + 1]) {
      upTo = argv[++i];
    } else if (argv[i] === "--force") {
      force = true;
    }
  }
  return { upTo, force };
}

async function main() {
  const { upTo, force } = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("חסר DATABASE_URL ב-.env.local");
    process.exit(1);
  }

  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
  const entries = journal.entries;
  const baselineIdx = entries.findIndex((e) => e.tag === upTo);
  if (baselineIdx === -1) {
    console.error(`תג לא נמצא ב-_journal.json: ${upTo}`);
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const { rows: tbl } = await client.query(`
      SELECT to_regclass('public.account') AS a,
             to_regclass('public.user_role') AS ur
    `);
    if (!tbl[0]?.a) {
      console.error(
        "טבלת account לא קיימת — נראה כמו מסד ריק. יש להריץ npm run db:migrate בלי baseline.",
      );
      process.exit(1);
    }
    if (!tbl[0]?.ur && upTo === "0001_multi_role") {
      console.error(
        "טבלת user_role לא קיימת — הסכמה עדיין לא כוללת 0001. יש להריץ רק npm run db:migrate (בלי baseline), או לתקן את המסד.",
      );
      process.exit(1);
    }

    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const { rows: existing } = await client.query(
      `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at ASC, id ASC`,
    );
    if (existing.length > 0 && !force) {
      console.log("כבר קיימות רשומות ב-drizzle.__drizzle_migrations:");
      console.table(existing);
      console.log(
        "\nיש לנסות קודם npm run db:migrate. אם נכשל על 'already exists', יש להריץ:\n  npm run db:baseline -- --force",
      );
      return;
    }

    for (let i = 0; i <= baselineIdx; i++) {
      const entry = entries[i];
      const sqlPath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
      if (!fs.existsSync(sqlPath)) {
        console.error(`חסר קובץ: ${sqlPath}`);
        process.exit(1);
      }
      const fileContent = fs.readFileSync(sqlPath, "utf8");
      const hash = crypto.createHash("sha256").update(fileContent).digest("hex");

      const dup = await client.query(
        `SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1 LIMIT 1`,
        [hash],
      );
      if (dup.rowCount > 0) {
        console.log(`כבר קיים hash עבור ${entry.tag} — דילוג.`);
        continue;
      }

      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [hash, entry.when],
      );
      console.log(`נרשמה מיגרציה כהוחלה: ${entry.tag} (created_at=${entry.when})`);
    }

    console.log("\nהבא: npm run db:migrate");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
