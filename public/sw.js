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

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
