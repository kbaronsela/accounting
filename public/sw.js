/**
 * Service worker מינימלי ל-PWA: Chrome דורש רישום SW + טיפול ב-fetch
 * כדי לאפשר התקנה/תצוגה כ-standalone בדפדפנים שנשענים על קריטריונים אלה.
 * אין כאן cache של דפים — רק העברת בקשות לרשת.
 * נרשם רק בהקשר מאובטח (HTTPS או localhost), לא על http://IP בתוך LAN.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * לא לדרוך במסדר fetch של בקשות API.
 * בסביבות PWA, שכבות ה-SW ובקשות `fetch()` פנימיות לפעמים מתנהגות אחרת מול קוקי/אימות
 * מתוך הדף — ומתקבל 404 מתוך היישום (למשל «לא נמצא באחסון» על GET לקובץ).
 * עבור רק `/api/` משאירים את ה-network stack הרגיל של הדפדפן ללא interception.
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const sameSite = url.origin === self.location.origin;

  if (sameSite && url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(fetch(event.request));
});
