# מפרט API (REST) — MVP

מסמך זה מתאר **נקודות קצה לוגיות**. הנתיב המדויק בפרויקט (למשל קידומת `/api/v1`) ייקבע ביישום.  
**אימות**: Auth.js — סשן/ JWT ב־cookie או header לפי בחירת הטמעה. בקשות ללא הרשאה מקבלות `401`; הרשאה לא מספקת `403`.

## 1. כללי תגובה ושגיאות

### 1.1 פורמט שגיאה (מומלץ אחיד)

```json
{
  "error": {
    "code": "INVITATION_EXPIRED",
    "message": "Human readable message",
    "details": {}
  }
}
```

### 1.2 קודי סטטוס נפוצים

| קוד | משמעות |
|-----|---------|
| `400` | גוף לא תקין / ולידציה |
| `401` | לא מחובר |
| `403` | תפקיד או שיוך לא מתאים |
| `404` | משאב לא קיים או אין גישה (מומלץ לא לחשוף הפרדה) |
| `409` | קונפליקט (למשל מייל כבר רשום, ההזמנה כבר נוצלה) |
| `410` | טוקן פג תוקף / בוטל |
| `422` | כלל עסקי (למשל submit ללא שדות חובה) |

---

## 2. הזמנות (ללא סשן לפני השלמה)

### 2.1 `GET /invitations/lookup`

**מטרה**: בדיקת תקפות טוקן לפני הצגת טופס השלמה (עמוד ציבורי).

**Query**: `token=<invitation_token>` (הטוקן ב-URL במייל; ב-API מועבר כפרמטר — לא בנתיב גולמי בלוג).

**Response 200**

```json
{
  "email": "user@example.com",
  "role": "client",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "clientDisplayName": "משפחת כהן"
}
```

**שגיאות**: `410` (פג / נוצל), `404` (טוקן לא תקף).

---

### 2.2 `POST /invitations/accept`

**מטרה**: השלמת חשבון מהזמנה — יצירת משתמש / קישור OAuth לאחר אימות.

**Body — סיסמה**

```json
{
  "token": "<invitation_token>",
  "password": "<min_length_policy>",
  "locale": "he"
}
```

**Body — אחרי OAuth (אם הזרימה היא צד שרת)**

במימושים רבים, OAuth מטופל ע״י Auth.js; אז endpoint זה עשוי להיות מצומצם ל-**Credentials בלבד**, וה-OAuth יאומת ב-callback שמשווה `email` ל־`invitations.email` הפעיל.

**Response 201**

```json
{
  "userId": "uuid",
  "role": "client",
  "redirectTo": "/client"
}
```

**שגיאות**: `409` (מייל תפוס במערכת שלא תואם הזמנה), `410`, ולידציה סיסמה `400`.

---

## 3. Admin (`role = admin`)

כל הנתיבים דורשים `admin`.

### 3.1 `POST /admin/accountants`

**מטרה**: יצירת הזמנה לרואה חשבון (ברוב המימושים אין עדיין `users` עד קבלת ההזמנה; אופציונלי “רשומה טיוטה” — לפי ה-ORM).

**Body**

```json
{
  "email": "cpa@example.com",
  "displayName": "רחל — רואת חשבון"
}
```

**Response 201**

```json
{
  "invitationId": "uuid",
  "email": "cpa@example.com",
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

**תופעה לוואי**: שליחת מייל הזמנה (אסינכרוני מקובל).

---

### 3.2 `GET /admin/accountants`

**מטרה**: רשימת רואי חשבון (משתמשים `role=accountant`) — סטטוס, מייל, תאריך.

**Query (אופציונלי)**: `cursor`, `limit`, `search`.

**Response 200**

```json
{
  "items": [
    {
      "id": "uuid",
      "email": "cpa@example.com",
      "displayName": "רחל",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

---

### 3.3 `PATCH /admin/accountants/:id` (אופציונלי MVP+)

**מטרה**: השבקה / הפעלה.

**Body**

```json
{
  "archived": true
}
```

---

## 4. Accountant (`role = accountant`)

`accountant` רואה רק לקוחות ומסמכים שבהם `clients.accountant_id = self`.

### 4.1 `GET /accountants/me`

**Response 200**

```json
{
  "id": "uuid",
  "email": "cpa@example.com",
  "locale": "he",
  "lastDocumentsSeenAt": "2026-01-01T00:00:00.000Z"
}
```

---

### 4.2 `PATCH /accountants/me/locale`

```json
{ "locale": "en" }
```

---

### 4.3 `POST /accountants/me/inbox/mark-seen`

**מטרה**: עדכון `last_documents_seen_at` לרגע הנוכחי (או ל-`body.upTo` אם מדיניות המוצר מאפשרת).

**Body (אופציונלי)**

```json
{ "upTo": "2026-01-15T23:59:59.000Z" }
```

**Response 204**

---

### 4.4 `GET /accountants/me/clients`

**Query**: `status`, `search`, `cursor`, `limit`.

**Response 200**

```json
{
  "items": [
    {
      "id": "uuid",
      "displayName": "משפחת כהן",
      "status": "active",
      "memberCount": 2,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

---

### 4.5 `POST /accountants/me/clients`

**מטרה**: פתיחת תיק + הזמנת חבר ראשון.

**Body**

```json
{
  "displayName": "משפחת כהן",
  "inviteEmail": "client@example.com",
  "memberRole": "primary"
}
```

**Response 201**

```json
{
  "client": {
    "id": "uuid",
    "displayName": "משפחת כהן",
    "status": "pending_invite"
  },
  "invitationId": "uuid",
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

---

### `PATCH /accountants/me/clients/:clientId`

**מטרה**: עדכון שם תצוגה של תיק שנפתח על ידי רואה החשבון המחובר — רק כשהתיק שייך אליו.

**Body**

```json
{ "displayName": "שם חדש" }
```

**Response 204** — אין גוף.

**שגיאות**: `400` ולידציה, `403`/`404` אין גישה.

**Audit**: `accountant_rename_client`.

---

### `DELETE /accountants/me/clients/:clientId`

**מטרה**: מחיקת התיק ובמסגרת DB גם רשומות מסמכים (cascade); קבצי העלאה מקומיים נמחקים אחרי מחיקת הרשומות.

**Response 204** — אין גוף.

**שגיאות**: `403`/`404` אין גישה.

**Audit**: `accountant_delete_client`.

---

### 4.6 `POST /accountants/me/clients/:clientId/members`

**מטרה**: הזמנת משתמש נוסף לאותו `client_id`.

**Body**

```json
{
  "email": "spouse@example.com",
  "memberRole": "member"
}
```

**Response 201** — כמו הזמנה + פירוט.

**שגיאות**: `403` אם התיק לא שייך לרואה החשבון.

---

### 4.7 `POST /invitations/:id/resend` (חשבונאי)

**מטרה**: שליחת מייל מחדש להזמנה קיימת שלא נוצלה (אותה לוגיקה כמו initial invite).

**Response 200** — `{ "expiresAt": "..." }` .

---

### 4.8 `POST /invitations/:id/revoke`

**Response 204**

---

### 4.9 `GET /accountants/me/documents`

**Query**

| פרמטר | תיאור |
|--------|--------|
| `clientId` | UUID |
| `from` / `to` | טווח **תאריך הגשה** — על `submitted_at` (YYYY-MM-DD) |
| `invoiceFrom` / `invoiceTo` | טווח **תאריך חשבונית** — `COALESCE(finalDate, extractedDate)` (YYYY-MM-DD) |
| `minAmount` / `maxAmount` | עשרוני — על `finalAmount` |
| `currency` | למשל `ILS` |
| `status` | ברירת מחדל: `submitted` לרשימת “שליחות”; אפשר להרחיץ לטיפול פנימי |
| `onlyNew` | `true` — מסנן לפי `submitted_at > last_documents_seen_at` |
| `cursor` / `limit` | עימוד |

**Response 200**

```json
{
  "items": [
    {
      "id": "uuid",
      "clientId": "uuid",
      "clientDisplayName": "משפחת כהן",
      "status": "submitted",
      "finalAmount": "123.45",
      "finalCurrency": "ILS",
      "finalDate": "2026-01-10",
      "finalVendor": "ספק לדוגמה",
      "submittedAt": "2026-01-12T10:00:00.000Z",
      "uploadedByEmail": "client@example.com"
    }
  ],
  "nextCursor": null
}
```

---

### 4.10 `GET /accountants/me/documents/:documentId`

**Response 200**

```json
{
  "id": "uuid",
  "clientId": "uuid",
  "status": "submitted",
  "finalAmount": "123.45",
  "finalCurrency": "ILS",
  "finalDate": "2026-01-10",
  "finalVendor": "ספק לדוגמה",
  "clientNote": "טקסט",
  "extracted": {},
  "submittedAt": "2026-01-12T10:00:00.000Z",
  "file": {
    "mimeType": "image/jpeg",
    "downloadUrl": "https://...presigned...",
    "expiresAt": "2026-01-12T10:15:00.000Z"
  }
}
```

---

## 5. Client (`role = client`)

הלקוח מזוהה לפי סשן; השרת יודע אילו `client_id` המשתמש רשאי אליהם דרך `client_members`. אם חבר רק בתיק אחד — רשימת המסמכים משויכת אוטומטית.

### 5.1 `GET /client/me`

**Response 200**

```json
{
  "user": {
    "id": "uuid",
    "email": "client@example.com",
    "locale": "he"
  },
  "clients": [
    {
      "id": "uuid",
      "displayName": "משפחת כהן",
      "role": "primary"
    }
  ]
}
```

---

### 5.2 `POST /client/documents/uploads`

**מטרה**: יצירת רשומת `documents` במצב `draft_uploading` + הנחיות להעלאה (presigned PUT).

**Body**

```json
{
  "clientId": "uuid",
  "mimeType": "image/jpeg",
  "byteSize": 1234567
}
```

**Response 201**

```json
{
  "documentId": "uuid",
  "upload": {
    "method": "PUT",
    "url": "https://storage...presigned...",
    "headers": { "Content-Type": "image/jpeg" }
  },
  "expiresAt": "2026-01-12T10:10:00.000Z"
}
```

---

### 5.3 `POST /client/documents/:documentId/complete-upload`

**מטרה**: לאשר שהקובץ נכח; להתחיל בדיקת איכות + OCR.

**Response 202** — `{ "status": "ocr_processing" }`. עיבוד OCR רץ ברקע; בסיום מצב המסמך יועדכן ל־`needs_review` (או `ocr_failed`). אם `OCR_DISABLED=1`, הממשק משאיר `uploaded` ללא OCR.

**שגיאות `400` (אם עדיין `draft_uploading`)**

- `UPLOAD_MISSING_FILE` — אין קובץ בשרת (לרוב ה־PUT לא הושלם).
- `UPLOAD_SIZE_MISMATCH` — יש קובץ אבל אורכו שונה מ־`byteSize` ברשומה.

---

### 5.4 `GET /client/documents/:documentId`

**Response 200** — דומה לגרסת accountant אך **ללא** שדות שמורים רק לצופה חיצוני; `downloadUrl` אם הרישום שייך ללקוח.

---

### 5.5 `GET /client/documents`

**Query**: `clientId`, `status`, `from`/`to`, עימוד.

---

### 5.6 `DELETE /client/documents/:documentId`

**מטרה**: מחיקת מסמך במצב `draft_uploading` בלבד (טיוטת העלאה תקועה); מוחק גם קובץ מקומי אם קיים.

**Response 204** — ללא גוף.

**שגיאות**: `409` אם הסטטוס כבר לא `draft_uploading`.

---

### 5.7 `PATCH /client/documents/:documentId`

**מטרה**: עריכת שדות לפני submit; רק כש־`status` מאפשר (למשל `needs_review`).

**Body**

```json
{
  "finalAmount": "123.45",
  "finalCurrency": "ILS",
  "finalDate": "2026-01-10",
  "finalVendor": "ספק",
  "clientNote": "הערה"
}
```

**Response 200** — אובייקט מסמך מעודכן.

---

### 5.8 `POST /client/documents/:documentId/submit`

**ולידציה**: שדות חובה מלאים (ראו `architecture.md` §7).

**Response 200**

```json
{
  "id": "uuid",
  "status": "submitted",
  "submittedAt": "2026-01-12T10:00:00.000Z"
}
```

**שגיאות**: `422` + פירוט שדות.

**תופעה לוואי**: מייל + ניסיון Web Push לרואה החשבון.

---

## 6. Web Push (רואה חשבון)

### 6.1 `GET /accountants/me/push/vapid-public-key`

**Response 200**

```json
{ "publicKey": "<base64>" }
```

---

### 6.2 `POST /accountants/me/push/subscribe`

**Body**

```json
{
  "endpoint": "https://...",
  "keys": { "p256dh": "...", "auth": "..." }
}
```

**Response 201**

---

### 6.3 `DELETE /accountants/me/push/subscribe`

**Body**: אותו `endpoint` או מזהה מנוי.

**Response 204**

---

## 7. Auth.js — נקודות קצה “שקופות”

ביישום Next.js, Auth.js מספקת לרוב נתיבים כמו `/api/auth/*`.  
מפרט זה **לא** מחליף את תיעוד Auth.js; הוא מתייחס רק לכך שהזרימה הציבורית כוללת:

- `signIn` עם Credentials
- OAuth providers עם **אימות מייל** מול `invitations` ב-callback או ב-`signIn` event

---

## 8. גרסאות עתידיות

- OpenAPI 3.1 YAML שנוצר מהקוד או ידנית: `openapi.yaml` (להוסיף כשמתייצבים).

---

## קישורים פנימיים

- `docs/architecture.md`
- `docs/screens.md`
- `docs/operations.md`
