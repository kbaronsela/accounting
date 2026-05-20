# תיעוד הפרויקט

| מסמך | תוכן |
|------|------|
| [architecture.md](./architecture.md) | מטרות MVP, סטאק (כולל Auth.js), תפקידים, זרימות, מודל נתונים, מצבי מסמך, ולידציה, “חדש” אצל רואה החשבון |
| [api.md](./api.md) | מפרט REST לוגי — הזמנות, admin, accountant, client, Web Push, קודי שגיאה |
| [screens.md](./screens.md) | מפת מסכים לפי תפקיד (לקוח / רואה חשבון / אדמין), i18n |

סדר קריאה מומלץ: `architecture` → `screens` → `api` → `operations`.

## מבנה קוד (שורש הפרויקט)

- `auth.ts` — הגדרת Auth.js (ספקים, adapter ל-Drizzle, callbacks).
- `auth.config.ts` — תצורה משותפת (כולל middleware בלי DB).
- `app/` — App Router (עמודים, `api/auth`, `api/invitations`, `api/admin`, `invite/`).
- `lib/db/` — סכמת Drizzle (`schema.ts`), מיגרציות ב-`lib/db/migrations/`.
- `lib/invitations/` — טוקנים והזמנות (lookup, accept, יצירה לאדמין).
- `types/next-auth.d.ts` — הרחבות טיפוס לסשן.
