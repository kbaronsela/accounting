# שיתוף קבלות / חשבוניות (PWA)

מערכת ללקוחות ולרואי חשבון — העלאת קבלות, עיבוד (OCR) והתראות.  
תיעוד ארכיטקטורה: [`docs/README.md`](docs/README.md).

## דרישות

- Node.js 20+
- PostgreSQL

## התקנה

```bash
npm install
cp .env.example .env.local
# הגדרי AUTH_SECRET (לפחות 32 תווים אקראיים) ו-DATABASE_URL
```

החלת סכמה על ה-DB (פיתוח):

```bash
npm run db:create
npm run db:push
```

אם מתחילים ממסד שכבר הכיל טבלאות מגרסה מוקדמת, או אם בלוגי השרת מופיעה שגיאת PostgreSQL `42P01` (טבלה לא קיימת) על `user_role` — **הריצי `npm run db:migrate`**, או הריצי שוב את האפליקציה ב־`npm run dev`: בפיתוח נוצרת הטבלה אוטומטית בעת התחברות (בפרודקשן חובה מיגרציה).

`db:create` יוצר את מסד הנתונים לפי השם ב-`DATABASE_URL` (למשל `.../accounting`), אחרי שהחלפת `USER:PASSWORD` בפרטי PostgreSQL אמיתיים.

**אדמין ראשון** (פעם אחת, אחרי `db:push`): ב־`.env.local` ממלאים `BOOTSTRAP_ADMIN_EMAIL` ו־`BOOTSTRAP_ADMIN_PASSWORD` (לפחות 12 תווים), ואז:

```bash
npm run db:bootstrap-admin
```

הסקריפט **אידמפוטנטי**: אם כבר קיים אדמין עם אותו מייל **וסיסמה** — לא ישתנה כלום. אם המייל קיים בלי `passwordHash` או בלי תפקיד `admin`, הסקריפט משלים (מועיל אחרי מיגרציה או OAuth).

**שדרוג סכמה:** להריץ **`npm run db:migrate`**.  
אם השגיאה היא **`relation "…" already exists`** — בדרך כלל המסד נוצר עם `db:push` וטבלת `drizzle.__drizzle_migrations` ריקה. אז:

1. `npm run db:baseline` — מסמן את `0000` ו־`0001` כהוחלות (לפי hash כמו Drizzle).
2. `npm run db:migrate` — מחילה רק את מה שנשאר (למשל `0002`, `0003`).

אם נראה שאין שינוי ב-DB: הריצי **`npm run db:status`** — תראי לאיזה מסד את מחוברת ואילו עמודות קיימות ב־`invitation`.  
מעקב Drizzle אחרי מיגרציות נמצא ב־**`drizzle.__drizzle_migrations`** (סכמה `drizzle`, לא `public`).  
אם `DATABASE_URL` בטרמינל שונה מזה של אפליקציית Next — המיגרציה תחול על מסד אחר.  
ב־Windows, אם הגדרת `DATABASE_URL` (או `PGUSER`) במשתמש/מערכת, הערך הישן היה נטען **לפני** `.env.local` ולא הוחלף; הסקריפטים ב־`scripts/*.cjs` טוענים כעת `.env.local` עם **`override: true`**. ניתן לבדוק ב־PowerShell: `echo $env:DATABASE_URL` ולנקות במידת הצורך את משתנה המערכת.

**הזמנות (פיתוח):**

- אדמין: בעמוד `/admin` — טופס «הזמנת רואה חשבון». הקישור מוחזר ב־JSON ובממשק + מודפס ללוג השרת (מייל עתידי).
- רואה חשבון: בעמוד `/accountant` — מסמכים לפי תיק (סינון), תיקים ולקוחות; API `GET /api/accountants/me/documents`, `GET .../documents/:id`, הורדה `GET .../documents/:id/file`, בנוסף `GET/POST /api/accountants/me/clients`, `POST .../clients/:clientId/members`.
- מוזמן: `/invite?token=...` — הגדרת סיסמה והתחברות.
- לקוח: דשבורד ב־`/client`, עריכת מסמך ב־`/client/documents/:id` (**שמירה + הגשה לרואה החשבון**); העלאות מקומיות בפיתוח תחת `.data/uploads`. API לדוגמה: `GET/PATCH /api/client/documents/:id`, `GET .../file`, `POST .../submit`, `POST .../uploads`, `PUT .../upload`.
- API: `GET /api/invitations/lookup?token=`, `POST /api/invitations/accept`, `POST /api/admin/accountants` (אדמין בלבד), `GET /api/admin/accountants`.

הרצה מקומית:

```bash
npm run dev
```

פתחי [http://localhost:3000](http://localhost:3000).

## סקריפטים

| פקודה | תיאור |
|--------|--------|
| `npm run dev` | שרת פיתוח (Turbopack) |
| `npm run build` / `npm start` | בנייה ופרודקשן מקומי |
| `npm run db:bootstrap-admin` | יצירת משתמש admin ראשון (פעם אחת) |
| `npm run db:generate` | יצירת מיגרציות Drizzle |
| `npm run db:baseline` | סנכרון מעקב מיגרציות אחרי `db:push` (לפני `db:migrate`) |
| `npm run db:migrate` | החלת מיגרציות (מדפיס שגיאות מלאות; לא רק drizzle-kit שקט) |
| `npm run db:status` | אבחון: שם DB, עמודות `invitation`, טבלאות מעקב `__drizzle_migrations` |
| `npm run db:push` | דחיפת סכמה ל-DB (פיתוח) |
| `npm run db:studio` | Drizzle Studio |

## סטאק

- Next.js (App Router), TypeScript, Tailwind
- **Auth.js** (`next-auth` v5) + **Drizzle ORM** + `pg`

## Bootstrap אדמין

ראו למעלה: `npm run db:bootstrap-admin` + `docs/operations.md`.

## אבטחת repository (Git / GitHub)

- **לא לקומט קבצים עם סודות:** כל מה שמתחיל ב־`.env` — מושמט ב־`.gitignore`, מלבד **`.env.example`** (רק placeholders).
- הקבצים `.env.local`, `.pem`, הרחבות credentials ב־JSON, וגם התיקייה **`.data/`** (העלאות מקומיות) לא אמורים להופיע אצל `git push`.
- **סודות בפרודקשן / Railway:** הגדירו רק במשתני הסביבה של הפלטפורמה או ב־CI Secrets — לא בתוך קוד ובקומיט.
- אם סוד זלגל ל־repository בעבר: החלפת ערך (למשל `AUTH_SECRET` חדש) + ניקוי היסטוריה (`git filter-repo` / תמיכה ב־GitHub) לפי הצורך.
