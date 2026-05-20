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
| `STORAGE_*` | כן | מפתחות S3/R2 — אזור, bucket, endpoint, credentials |
| `STORAGE_PUBLIC_READ` | לא | ברירת מחדל **false** — גישה דרך presigned בלבד |
| `OCR_*` | לפי ספק | מפתחות/פרויקט Document AI / Textract וכו׳ |
| `REDIS_URL` / `QUEUE_*` | אופציונלי | לתור עיבוד OCR אם לא serverless מובנה |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | לפוש | Web Push — `subject` בד״כ `mailto:…` |
| `BOOTSTRAP_ADMIN_EMAIL` | פריסה ראשונה | מייל האדמין הראשון |
| `BOOTSTRAP_ADMIN_PASSWORD` | פריסה ראשונה בלבד | סיסמה זמנית; **לסובב מיד** אחרי כניסה ראשונה |

> שמות המשתנים המדויקים ייתאמו לקוד בפועל; הרשימה היא **חוזה לוגי**.

---

## 3. Bootstrap — אדמין ראשון

**מטרה**: קיים משתמש `role=admin` אחד לפחות ללא הזמנה.

**אפשרויות יישום** (לבחור אחת):

1. **סקריפט חד-פעמי** בפריסה: קורא `BOOTSTRAP_ADMIN_*`, יוצר משתמש אם לא קיים, מדפיס “bootstrap complete”.
2. **מיגרציית DB** עם hook (פחות מומלץ — סיסמאות ב-repo).
3. **ממשק CLI פנימי** (`pnpm ops bootstrap-admin`) — זמין רק למחזיקי סודות.

**מדיניות**

- אחרי כניסה ראשונה: **חובת החלפת סיסמה** או מחיקת סיסמת bootstrap לאחר הגדרת MFA (עתידי).
- רישום `audit_events` ל-`bootstrap` הראשון.

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

## 5. Web Push

1. יצירת זוג מפתחות VAPID (פקודה/כלי מהספרייה `web-push`).
2. שמירת מפתח פרטי בסביבת שרת; חשיפת מפתח ציבורי ל-PWA.
3. **Subscription**: רישום דרך `POST /accountants/me/push/subscribe`; אחסון ב-`push_subscriptions`.
4. **שידור**: לאחר `submit`, לולאה על מנויי רואה החשבון; כשלים (410 Gone וכו׳) → מחיקת מנוי.

**הערת מוצר**: ב-iOS Web Push תלוי התקנה/PWA; המייל נשאר גיבוי.

---

## 6. אחסון קבצים

- **Bucket** ייעודי; אין רשימת directory public.
- **העלאה**: presigned PUT; **הורדה**: presigned GET קצר (למשל 5–15 דקות).
- מדיניות **lifecycle** (ארכיון/מחיקה) — להגדיר עסקית בהמשך.
- סריקת וירוסים (אופציונלי ב-MVP): שירות צד ג׳ או Lambda.

---

## 7. OCR / תור עיבוד

- Worker נפרד או פונקציה async: מקבל `documentId`, מוריד קובץ (פנימי), קורא לספק OCR, מעדכן DB.
- retries עם exponential backoff; dead-letter או סטטוס `ocr_failed` + לוג.
- **לא** לשמור API keys בלוגים.

---

## 8. צ׳ק-ליסט פריסה (Production)

- [ ] `AUTH_SECRET` וסודות OAuth חדשים וייחודיים לפרוד.
- [ ] `DATABASE_URL` עם TLS; משתמש DB עם הרשאות מינימליות.
- [ ] גיבוי אוטומטי ל-DB + בדיקת שחזור.
- [ ] Bucket עם גיבוי/גרסאות אם נדרש.
- [ ] HTTPS מלא; Secure cookies לסשן Auth.js.
- [ ] CORS ו-`AUTH_URL` תואמים לדומיין האמיתי.
- [ ] מניעת דליפת stack traces ללקוח.
- [ ] ניטור (לפחות לוגים + alerts על שגיאות 5xx).
- [ ] רוטציית מפתחות (תכנון עתידי ל-VAPID / מייל / storage).

---

## 9. עסקי ומשפטי (תזכורת, לא ייעוץ משפטי)

- מדיניות פרטיות ושמירת מסמכים פיננסיים.
- הסכמי עיבוד (DPA) מול ספקי OCR/מייל/ענן במידת הצורך.
- תנאי שימוש וגילוי נאות על שימוש ב-OCR חיצוני.

---

## 10. קישורים פנימיים

- `docs/architecture.md` — ארכיטקטורה ומודל נתונים
- `docs/screens.md` — מפת מסכים
- `docs/api.md` — נקודות קצה REST
