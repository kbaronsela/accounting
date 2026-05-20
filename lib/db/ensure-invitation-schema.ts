import type pg from "pg";

let invitationSchemaInflight: Promise<void> | null = null;

/**
 * מבטיח שעמודת invitation.inviteeDisplayName ואינדקס ייחודי ל-tokenHash קיימים (מקביל ל־0002).
 * בפרודקשן: שגיאה עם הוראה להריץ db:migrate.
 */
export async function ensureInvitationSchema(pool: pg.Pool): Promise<void> {
  if (!invitationSchemaInflight) {
    invitationSchemaInflight = runEnsure(pool).finally(() => {
      invitationSchemaInflight = null;
    });
  }
  await invitationSchemaInflight;
}

async function runEnsure(pool: pg.Pool): Promise<void> {
  const col = await pool.query(`
    SELECT 1 AS x FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invitation'
      AND column_name = 'inviteeDisplayName'
    LIMIT 1
  `);

  if ((col.rowCount ?? 0) > 0) {
    await ensureTokenHashUniqueIndex(pool);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      'חסרה עמודה "inviteeDisplayName" בטבלת invitation. הריצי: npm run db:migrate',
    );
  }

  const client = await pool.connect();
  try {
    console.warn(
      '[db] חסרה עמודה invitation.inviteeDisplayName — נוצרת אוטומטית (פיתוח). בפרודקשן: npm run db:migrate',
    );
    await client.query(`
      ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "inviteeDisplayName" text
    `);
  } finally {
    client.release();
  }

  await ensureTokenHashUniqueIndex(pool);
}

async function ensureTokenHashUniqueIndex(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "invitation_tokenHash_unique" ON "invitation" ("tokenHash")
  `);
}
