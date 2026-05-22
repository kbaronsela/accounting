import type pg from "pg";

let invitationSchemaInflight: Promise<void> | null = null;

/**
 * מבטיח עמודות הזמנה ואינדקס tokenHash (מקביל למיגרציות 0002+).
 * בפרודקשן: חוסר עמודה → שגיאה עם הוראה להריץ db:migrate.
 */
export async function ensureInvitationSchema(pool: pg.Pool): Promise<void> {
  if (!invitationSchemaInflight) {
    invitationSchemaInflight = runEnsure(pool).finally(() => {
      invitationSchemaInflight = null;
    });
  }
  await invitationSchemaInflight;
}

async function columnExists(
  pool: pg.Pool,
  columnName: string,
): Promise<boolean> {
  const r = await pool.query(
    `
    SELECT 1 AS x FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invitation'
      AND column_name = $1
    LIMIT 1
  `,
    [columnName],
  );
  return (r.rowCount ?? 0) > 0;
}

async function runEnsure(pool: pg.Pool): Promise<void> {
  const hasInviteeName = await columnExists(pool, "inviteeDisplayName");
  if (!hasInviteeName) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        'חסרה עמודה "inviteeDisplayName" בטבלת invitation. יש להריץ: npm run db:migrate',
      );
    }
    const client = await pool.connect();
    try {
      console.warn(
        '[db] חסרה עמודה invitation.inviteeDisplayName — נוצרת אוטומטית (פיתוח).',
      );
      await client.query(`
        ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "inviteeDisplayName" text
      `);
    } finally {
      client.release();
    }
  }

  const hasMemberRole = await columnExists(pool, "clientMemberRole");
  if (!hasMemberRole) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        'חסרה עמודה "clientMemberRole" בטבלת invitation. יש להריץ: npm run db:migrate',
      );
    }
    const client = await pool.connect();
    try {
      console.warn(
        '[db] חסרה עמודה invitation.clientMemberRole — נוצרת אוטומטית (פיתוח).',
      );
      await client.query(`
        ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "clientMemberRole" text
      `);
    } finally {
      client.release();
    }
  }

  await ensureTokenHashUniqueIndex(pool);
}

async function ensureTokenHashUniqueIndex(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "invitation_tokenHash_unique" ON "invitation" ("tokenHash")
  `);
}
