# תפעול, פריסה וסודות (Operations)

מסמך זה משלים את `docs/architecture.md` ו-`docs/api.md`: משתני סביבה, bootstrap לאדמין, אינטגרציות, וצ׳ק-ליסט פריסה.

## 1. סביבות

- **local**: פיתוח מקומי; DB ואחסון יכולים להיות docker / emulators.
- **staging**: כמו פרודקשן אך עם נתונים בדויים; מומלץ לבדיקת מייל/OCR לפני עליה.
- **production**: פרודקשן עם ניטור, גיבויים, ורוטציית סודות.

---

## 2. משתני סביבה (טיוטת רשימה)

ערכים ב-`UPPER_SNAKE_CASE`. **לא** לקבע בקוד ולא לערבב בקומיט.

| משתנה | נדרש | תיאור |
|--------|------|--------|
| `DATABASE_URL` | כן | מחרוזת חיבור PostgreSQL |
| `AUTH_SECRET` | כן | סוד Auth.js לחתימת סשן (אורך מספיק; מנוע cryptographically secure) |
| `AUTH_URL` | כן בפרוד | כתובת בסיס ציבורית של האפליקציה לצורך callbacks |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | לפי OAuth | Auth.js — Google |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | לפי OAuth | Auth.js — Facebook |
| `EMAIL_PROVIDER_API_KEY` | כן (MVP) | מפתח ספק מייל (Resend / Postmark / וכו׳) |
| `EMAIL_FROM` | כן | כתובת שולח (למשל `noreply@domain`) |
| `STORAGE_*` | בפרוד (או S3) | מפתחות S3/R2 — אזור, bucket, endpoint, credentials |
| `STORAGE_PUBLIC_READ` | לא | ברירת מחדל **false** — גישה דרך presigned בלבד |
| `LOCAL_UPLOAD_DIR` | לא (פיתוח) | תיקיית יעד לקבצים מקומיים ביחס ל־cwd; ברירת מחדל **`.data/uploads`** |
| `OCR_*` | לפי ספק | מפתחות/פרויקט Document AI / Textract וכו׳ |
| `REDIS_URL` / `QUEUE_*` | אופציונלי | לתור עיבוד OCR אם לא serverless מובנה |
| `BOOTSTRAP_ADMIN_EMAIL` | פריסה ראשונה | מייל האדמין הראשון |
| `BOOTSTRAP_ADMIN_PASSWORD` | פריסה ראשונה בלבד | סיסמה זמנית; **לסובב מיד** אחרי כניסה ראשונה |

> שמות המשתנים המדויקים ייתאמו לקוד בפועל; הרשימה היא **חוזה לוגי**.

### Google OAuth והתחברות

- הגדרה: `GOOGLE_CLIENT_ID` ו־`GOOGLE_CLIENT_SECRET` ב־`.env.local` (ראו גם `.env.example` ל־redirect URIs מומלצים).
- ב־Google Cloud חייב להופיע redirect: `https://<האתר>/api/auth/callback/google` (ובמקומי: `http://localhost:3000/api/auth/callback/google`; לבדיקה מרשת LAN — גם עם `http://<IP-המחשב>:3000/...`).
- `AUTH_URL` צריך להתאים לכתובת שבה משתמש המשתמש (במיוחד בבדיקה מנייד).
- Google מותר **רק למייל שכבר קיים עם תפקיד** (השלמת הזמנה או bootstrap אדמין). אחרי מכן אפשר לקשר את אותה כתובת ב־Google למשתמש הקיים.
- מסך **שינוי/הגדרת סיסמה** (אחרי התחברות): `/settings/password` (גם למי שנכנס עם Google ומעדיף גם סיסמה).

### Progressive Web App (הוספה למסך הבית)

- בפרודקשן עם **HTTPS** האתר משתמש ב־`/manifest.webmanifest` (מתוך `app/manifest.ts`) וב־`public/sw.js`, כדי שכרום יוכל להתקין/לפתוח ב־**standalone**. ב־manifest מוגדר **`share_target` עם URL מוחלט לפי `AUTH_URL`**, כדי שהשיתוף מהגלריה לא ייפתח ב־`localhost` על הטלפון. באירוח ב־Railway — ודאי ש־`AUTH_URL=https://<הדומיין>` זמין **גם בשלב הבילד**.
- **אם הותקנה אפליקציה מהמסך הבית מתוך `http://localhost:...`** (כולל פורט 8080) ושיתוף מתמונה מתעקש על localhost — הסירי את האייקון, פתחי מחדש רק מהדומיין הפרודקטיבי, והוסיפי למסך הבית שוב.
- **`http://<IP בתוך ה-LAN>`** (לא localhost ולא HTTPS) אינו *secure context*: **רישום Service Worker לא יעבוד**, וברוב המקרים **מוצג** קיצור דרך עם סמל קטן של כרום — התנהגות צפויה. לבדיקה מהטלפון: **Tunnel עם HTTPS** (למשל ngrok / Cloudflare Tunnel) או אירוח על דומיין עם TLS.
- איקונים: `npm run icons:pwa` יוצר `public/icons/icon-*.png` (מסמך/חשבונית בסגנון משטח בצבע האפליקציה; ניתן לערוך ב־`scripts/generate-pwa-icons.ps1`).
- אחרי שינוי איקון/manifest כדאי **למחוק את הקיצור הישן ממסך הבית ולהוסיף מחדש**.

---

## 3. Bootstrap — אדמין ראשון

**מטרה**: קיים משתמש `role=admin` אחד לפחות ללא הזמנה.

**בפרויקט (מקומי / שרת):** אחרי `DATABASE_URL` תקין וטבלאות (`db:push`), מגדירים ב־`.env.local`:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD` (מינימום 12 תווים)

ואז מריצים:

```bash
npm run db:bootstrap-admin
```

אם **למייל ב־`BOOTSTRAP_ADMIN_EMAIL` כבר יש תפקיד admin וסיסמה ב־DB**, הסקריפט לא משנה כלום. אחרת הוא משלים: **מגדיר `passwordHash`** אם חסר (למשל משתמש מ־OAuth), **מוסיף תפקיד `admin`** אם חסר, או יוצר משתמש חדש — בלי לצאת מוקדם רק בגלל שקיים admin אחר.

**אלטרנטיבות** (אופציונלי): מיגרציית DB עם סוד ב-repo (לא מומלץ), או CLI פנימי נפרד.

**מדיניות**

- אחרי כניסה ראשונה: **חובת החלפת סיסמה** או מחיקת סיסמת bootstrap לאחר הגדרת MFA (עתידי).
- רישום `audit_events` ל-`bootstrap` הראשון.

**מיגרציות Drizzle**

- `npm run db:migrate` מריץ את ה-SQL מתיקיית `lib/db/migrations` ומעדכן את `drizzle.__drizzle_migrations`.
- אם `npm run db:migrate` נכשל עם **relation already exists** אחרי שימוש ב־`db:push`: `npm run db:baseline` ואז שוב `npm run db:migrate`.
- אם נראה שהמסד לא משתנה: `npm run db:status` — `current_database`, עמודות `invitation`, והיסטוריית מיגרציות. יש לוודא ש־`DATABASE_URL` זהה לזה של `next dev`.

### אדמין — הסרת רואה חשבון

ב־`/admin` הטבלה «ניהול רואי חשבון» מאפשרת להסיר רואה חשבון מהמערכת:

- **אין תיקי לקוח**: נמחק תפקיד `accountant`; אין תפקידים נוספים — נמחק המשתמש (כולל סשן/OAuth בסיסי בגלל הרקורסיה במסד).
- **יש תיקים**: **העברה** אל רואה חשבון אחר (כול התיקים) או **מחיקת כל התיקים** (לא הפיך, כולל מסמכים ב־DB; קבצי upload מקומיים נוקו אחרי commit).

פרוגרמתית: `DELETE /api/admin/accountants/[userId]` — גוף `{}` כשאין לקוחות; אחרת `{ "transferToAccountantUserId": "<uuid>" }` או `{ "deleteAllClients": true }`.

---

## 4. מייל טרנזקציוני

**תבניות מינימליות**

| אירוע | נמען | תוכן לדוגמה |
|--------|------|----------------|
| הזמנת accountant | מייל רואה חשבון | קישור עם `token` |
| הזמנת client | מייל לקוח | קישור + שם תיק |
| מסמך נשלח (`submitted`) | מייל רואה חשבון | סיכום שדות + קישור לאפליקציה |

**דרישות**

- שפת מייל: לפחות עברית או אנגלית לפי `locale` של הנמען (אופציונלי ב-MVP).
- Rate limiting על שליחת הזמנות חוזרות.

---

## 5. אחסון קבצים

- **Bucket** ייעודי; אין רשימת directory public.
- **העלאה**: presigned PUT; **הורדה**: presigned GET קצר (למשל 5–15 דקות).
- מדיניות **lifecycle** (ארכיון/מחיקה) — להגדיר עסקית בהמשך.
- סריקת וירוסים (אופציונלי ב-MVP): שירות צד ג׳ או Lambda.

---

## 6. OCR / תור עיבוד

- Worker נפרד או פונקציה async: מקבל `documentId`, מוריד קובץ (פנימי), קורא לספק OCR, מעדכן DB.
- בסיום טקסט: היוריסטיקה הפנימית (`heuristic-fields`) מנסה למלא סכום, תאריך, ספק וכן **מספר חשבונית/קבלה** (לפי תוויות בשפה — תוצאות ב־`extracted` + עמודות `extracted*` / `final*`).
- retries עם exponential backoff; dead-letter או סטטוס `ocr_failed` + לוג.
- **לא** לשמור API keys בלוגים.

---

## 7. צ׳ק-ליסט פריסה (Production)

- [ ] `AUTH_SECRET` וסודות OAuth חדשים וייחודיים לפרוד.
- [ ] `DATABASE_URL` עם TLS; משתמש DB עם הרשאות מינימליות.
- [ ] גיבוי אוטומטי ל-DB + בדיקת שחזור.
- [ ] Bucket עם גיבוי/גרסאות אם נדרש.
- [ ] HTTPS מלא; Secure cookies לסשן Auth.js.
- [ ] CORS ו-`AUTH_URL` תואמים לדומיין האמיתי.
- [ ] מניעת דליפת stack traces ללקוח.
- [ ] ניטור (לפחות לוגים + alerts על שגיאות 5xx).
- [ ] רוטציית מפתחות (תכנון עתידי למייל / storage).

---

## 8. עסקי ומשפטי (תזכורת, לא ייעוץ משפטי)

- מדיניות פרטיות ושמירת מסמכים פיננסיים.
- הסכמי עיבוד (DPA) מול ספקי OCR/מייל/ענן במידת הצורך.
- תנאי שימוש וגילוי נאות על שימוש ב-OCR חיצוני.

---

## 9. קישורים פנימיים

- `docs/architecture.md` — ארכיטקטורה ומודל נתונים
- `docs/screens.md` — מפת מסכים
- `docs/api.md` — נקודות קצה REST
