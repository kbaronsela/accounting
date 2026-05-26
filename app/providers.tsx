"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

/** רישום SW רק בהקשר מאובטח — נדרש ל-PWA תקין בכרום; לא על http://IP בתוך רשת ביתית */
function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;
    void navigator.serviceWorker.register("/sw.js?v=4").catch(() => {});
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      {children}
    </SessionProvider>
  );
}
