import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** חבילות כבדות (WASM / pdfjs) לא לקשור בתוך הבאנדל */
  serverExternalPackages: ["pdf-parse", "tesseract.js"],
  /** מכשירים ברשת המקומית שפותחים את dev (למשל טלפון ב־LAN) — IP של המחשב או מה שמופיע בלוג ההתרעה */
  allowedDevOrigins: ["192.168.50.249"],
  /**
   * ברירת מחדל ~10MiB על גביית גוף בקשות דרך הפרוקסי — מתחת ל־20MiB הצהרות של העלאה,
   * מה שחותך PUT ומתרגם בדפדפן כ־„שגיאת רשת”.
   */
  experimental: {
    proxyClientMaxBodySize: "22mb",
  },
};

export default nextConfig;
