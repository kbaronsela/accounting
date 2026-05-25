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
| `422` | כלל עסקי (למשל פורמט שדות לא תקין ב-submit או PATCH) |

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

### 3.3 `PATCH /api/admin/accountants/:userId`

**מטרה**: עדכון שם תצוגה (`users.name`) ו/או אימייל — רק משתמש שיש לו תפקיד `accountant`.

**Body** (חייב להכיל לפחות אחד)

```json
{
  "displayName": "רחל",
  "email": "cpa@example.com"
}
```

**התנהגות**: שינוי אימייל נחסם למשתמשים עם חשבון OAuth (`google`, `facebook`); התנגשות מייל → `409`.

**Response 200**

```json
{
  "item": {
    "id": "uuid",
    "email": "cpa@example.com",
    "displayName": "רחל",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "clientCount": 3
  }
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

פרמטר `search` מתאים לכל אחד מכך ברמת הלקוח: **שם הלקוח**, **כתובת אימייל או שם משתמש** של חברי הלקוח, או **אימייל / שם מוזמן** בהזמנת לקוח שעדיין לא נוצלה.

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

**מטרה**: פתיחת לקוח + עד ארבע הזמנות למשתמשים (ראשון primary, ההמשך member בברירת מחדל).

**Body**

```json
{
  "clientName": "משפחת כהן",
  "users": [
    {
      "email": "primary@example.com",
      "inviteeDisplayName": "אורז אופציונלי"
    },
    {
      "email": "member@example.com"
    }
  ]
}
```

`inviteeDisplayName` אופציונלי; כל המיילים ייחודיים בגוף; `users.length` חייב להיות בין 1 ל־4.

**Response 201**

```json
{
  "client": {
    "id": "uuid",
    "displayName": "משפחת כהן",
    "status": "pending_invite"
  },
  "invitations": [
    {
      "invitationId": "uuid",
      "email": "primary@example.com",
      "expiresAt": "…",
      "inviteUrl": "https://…"
    }
  ]
}
```

---

### `GET /accountants/me/clients/:clientId`

**מטרה**: פרטי לקוח, חברים פעילים, והזמנות פתוחות.

**Response 200**: `{ client, members, pendingInvitations }`

---

### `PATCH /accountants/me/clients/:clientId`

**מטרה**: עדכון שם התצוגה של הלקוח (רק ברשות רואה החשבון שהוא הבעלים).

**Body**

```json
{ "displayName": "שם חדש" }
```

**Response 200** — `{ "client": { … } }`

**שגיאות**: `400`, `403`, `404`

**Audit**: `accountant_rename_client`.

---

### `DELETE /accountants/me/clients/:clientId`

**מטרה**: מחיקת הלקוח ומסמכיו במסד; בהמשך גם קבצי העלאה מקומיים.

**Response 204** — ללא גוף.

**שגיאות**: `403`, `404`

**Audit**: `accountant_delete_client`.

---

### `PATCH /accountants/me/clients/:clientId/members/:userId`

עדכון שם תצוגה ו/או אימייל למשתמש שנרשם. שינוי אימייל אסור אם למשתמש יש OAuth (Google/Facebook).

**Body**: `{ "displayName"?: string, "email"?: string }` — לפחות אחד.

**Response 200** — `{ "member": { "userId", "email", "displayName" } }`

---

### `DELETE /accountants/me/clients/:clientId/members/:userId`

הסרת משתמש מהלקוח. אם אחרי המחיקה אין למשתמש עוד הרשאות השתייכות (`client_member`) אל אף לקוח — מוסר גם התפקיד הגלובלי `client`.

**Response 204**

---

### `PATCH /accountants/me/clients/:clientId/invitations/:invitationId`

עריכת הזמנה ממתינה: שם מוזמן או כתובת אימייל.

**Body**: `{ "inviteeDisplayName"?: string, "email"?: string }`

**Response 200** — `{ "pendingInvitation": { … } }`

---

### `DELETE /accountants/me/clients/:clientId/invitations/:invitationId`

ביטול ההזמנה (מסומנת עם `consumed_at` והקישור נחסם).

**Response 204**

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

**שגיאות**: `403` אם הלקוח לא שייך לרואה החשבון.

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
| `from` / `to` | טווח **עדכון אחרון במערכת** — על `updated_at` (YYYY-MM-DD) |
| `invoiceFrom` / `invoiceTo` | טווח **תאריך חשבונית** — `COALESCE(finalDate, extractedDate)` (YYYY-MM-DD) |
| `minAmount` / `maxAmount` | עשרוני — על `finalAmount` (הסכומים מובנים כש״ח) |
| `status` | סינון מדויק לפי סטטוס המסמך (`uploaded`, `approved`, `all`, וכו’) — ב־UI ברירת המחדל למסמכים למעקב היא `uploaded` |
| `cursor` / `limit` | עימוד |

**Response 200**

```json
{
  "items": [
    {
      "id": "uuid",
      "clientId": "uuid",
      "clientDisplayName": "משפחת כהן",
      "status": "uploaded",
      "finalAmount": "123.45",
      "finalCurrency": "ש״ח",
      "finalDate": "2026-01-10",
      "finalVendor": "ספק לדוגמה",
      "submittedAt": "2026-01-12T10:00:00.000Z",
      "uploadedByDisplayName": "אורז"
    }
  ],
  "nextCursor": null
}
```

**העלאה מצד הרו״ח** (פרטים מלאים כמו בסעיפים 5.2–5.4 ללקוח — אותם גופים ובדיקות):

- `POST /accountants/me/documents/uploads` — `clientId` חייב להיות לקוח ש־`accountant_id` שלו הוא המשתמש המחובר; `uploaded_by_user_id` יירשם כרואה החשבון.
- `PUT /accountants/me/documents/:documentId/upload` — בעלות ובמצבי סטטוס כמו העלאת לקוח.
- `POST /accountants/me/documents/:documentId/complete-upload` — השלמת העלאה והפעלת OCR.

---

`uploadedByDisplayName` מתוך שם המשתמש ב־DB; ללא שם — `null`.

### 4.10 `GET /accountants/me/documents/:documentId`

**Response 200**

```json
{
  "id": "uuid",
  "clientId": "uuid",
  "status": "submitted",
  "finalAmount": "123.45",
  "finalCurrency": "ש״ח",
  "finalDate": "2026-01-10",
  "finalVendor": "ספק לדוגמה",
  "finalInvoiceNumber": "10042",
  "extractedInvoiceNumber": "10042",
  "clientNote": "טקסט",
  "extracted": {},
  "submittedAt": "2026-01-12T10:00:00.000Z",
  "mimeType": "image/jpeg",
  "editableInvoiceFields": true,
  "file": {
    "mimeType": "image/jpeg",
    "downloadUrl": "https://...presigned...",
    "expiresAt": "2026-01-12T10:15:00.000Z"
  }
}
```

- `editableInvoiceFields`: `true` כאשר הרו״ח רשאי לעדכן את שדות החשבונית (לאחר הגשה — בעיקר במצבים `submitted`, `archived`).

---

### `PATCH /accountants/me/documents/:documentId`

גוף זהה ל־`PATCH /client/documents/:documentId` (כולל `finalInvoiceNumber` אופציונלי, `finalAmount`, `finalCurrency`, `finalDate` בפורמט ISO, `finalVendor`, `clientNote`; ערך ריק בשדות מותאמים מתורגם ל־`null` בהתאמה).

זמין רק כאשר המסמך במצב שמאפשר עריכה אצל הרו״ח (כפי ש־`GET` מציין ב־`editableInvoiceFields`). כמו בשליחה לקוחית: **אין** שדות חובה; אם משהו צוין — ולידציית פורמט זהה.

---

### `DELETE /accountants/me/documents/:documentId`

מחיקה מלאה של המסמך (אחסון + רשומה) — רק למסמכים של לקוח המשוייך לרו״ח.

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

**Response 202** — `{ "status": "ocr_processing" }`. עיבוד OCR רץ ברקע; בסיום מצב המסמך יועדכן ל־`needs_review` (או `ocr_failed`). אם `OCR_DISABLED=1`, הממשק משאיר `uploaded` ללא OCR. בסיום OCR היוריסטיקה מנסה לזהות גם **מספר חשבונית/קבלה** (`extractedInvoiceNumber`); כאשר `finalInvoiceNumber` ריק, הערך משוכפל אליו.

**שגיאות `400` (אם עדיין `draft_uploading`)**

- `UPLOAD_MISSING_FILE` — אין קובץ בשרת (לרוב ה־PUT לא הושלם).
- `UPLOAD_SIZE_MISMATCH` — יש קובץ אבל אורכו שונה מ־`byteSize` ברשומה.

---

### 5.4 `GET /client/documents/:documentId`

**Response 200** — פרטי המסמך ללקוח, כולל `finalInvoiceNumber` (ערוך / ממולא מהחילוץ) ו־`extractedInvoiceNumber` (מה־OCR — לעיתים `null`); `file` עם `downloadUrl` אם הרישום שייך ללקוח.

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
  "finalCurrency": "ש״ח",
  "finalDate": "2026-01-10",
  "finalVendor": "ספק",
  "finalInvoiceNumber": "INV-1001",
  "clientNote": "הערה"
}
```

שדות PATCH הם אופציונליים לפי מה שמשנים; **`finalInvoiceNumber`** אינו חובה להגשה.

**Response 200** — אובייקט מסמך מעודכן.

---

### 5.8 `POST /client/documents/:documentId/submit`

**ולידציה**: כל השדות אופציונליים. אם הלקוח ממלא ערך — נדרשת התאמה לפורמט (ראו `architecture.md` §7); שדות ריקים אינם גורמים ל־422.

**Response 200**

```json
{
  "id": "uuid",
  "status": "submitted",
  "submittedAt": "2026-01-12T10:00:00.000Z"
}
```

**שגיאות**: `422` + פירוט שדות.

**תופעה לוואי**: שליחת **מייל** לרואה החשבון (כאשר הגדרת המייל בשרת מאופשרת).

---

## 6. Auth.js — נקודות קצה “שקופות”

ביישום Next.js, Auth.js מספקת לרוב נתיבים כמו `/api/auth/*`.  
מפרט זה **לא** מחליף את תיעוד Auth.js; הוא מתייחס רק לכך שהזרימה הציבורית כוללת:

- `signIn` עם Credentials
- OAuth providers עם **אימות מייל** מול `invitations` ב-callback או ב-`signIn` event

---

## 7. גרסאות עתידיות

- OpenAPI 3.1 YAML שנוצר מהקוד או ידנית: `openapi.yaml` (להוסיף כשמתייצבים).

---

## קישורים פנימיים

- `docs/architecture.md`
- `docs/screens.md`
- `docs/operations.md`
