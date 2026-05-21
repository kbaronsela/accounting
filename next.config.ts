import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** חבילות כבדות (WASM / pdfjs) לא לקשור בתוך הבאנדל */
  serverExternalPackages: ["pdf-parse", "tesseract.js"],
  /** מכשירים ברשת המקומית שפותחים את dev (למשל טלפון ב־LAN) — IP של המחשב או מה שמופיע בלוג ההתרעה */
  allowedDevOrigins: ["192.168.50.249"],
};

export default nextConfig;
