/**
 * אבחון: איזה DB מחובר, עמודות ב-invitation, ורשומות ב-drizzle.__drizzle_migrations
 */
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  override: true,
});
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("חסר DATABASE_URL");
  process.exit(1);
}

async function main() {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const dbName = await c.query("SELECT current_database() AS db");
    console.log("current_database:", dbName.rows[0].db);

    const cols = await c.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invitation'
      ORDER BY ordinal_position
    `);
    console.log("\nעמודות public.invitation:");
    console.table(cols.rows);

    const migTable = await c.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = '__drizzle_migrations'
    `);
    console.log("\nטבלת מעקב מיגרציות:");
    console.table(migTable.rows);

    if (migTable.rows.length > 0) {
      const sch = migTable.rows[0].table_schema;
      const hist = await c.query(
        `SELECT id, hash, created_at FROM "${sch}"."__drizzle_migrations" ORDER BY id`,
      );
      console.log("\nהיסטוריית מיגרציות (לפי id):");
      console.table(hist.rows);
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
