/**
 * גוף Web App Manifest (למסלול `/manifest.webmanifest`).
 * `base` חייב להיות מוחלט (כולל סכימה), ללא סלאש בסוף.
 *
 * ללא `share_target` — האפליקציה לא מוצעת בתור יעד «שיתוף» מהגלריה במובייל.
 */
export function buildWebAppManifest(base: string) {
  return {
    id: `${base}/`,
    name: "שיתוף קבלות",
    short_name: "קבלות",
    description: "פלטפורמה לשיתוף קבלות וחשבוניות",
    start_url: `${base}/?source=pwa`,
    scope: `${base}/`,
    display: "standalone",
    display_override: ["standalone", "browser"],
    background_color: "#f4faf9",
    theme_color: "#0f766e",
    lang: "he",
    dir: "rtl",
    prefer_related_applications: false,
    icons: [
      {
        src: `${base}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
