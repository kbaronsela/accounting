"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { SignOutButton } from "../admin/sign-out-button";
import { AccountantClientsPanel } from "./accountant-clients-panel";
import { AccountantDocumentsPanel } from "./accountant-documents-panel";
import { AccountantUsersPlaceholderPanel } from "./accountant-users-placeholder-panel";

type Section = "documents" | "clients" | "users";

const NAV: { section: Section; label: string }[] = [
  { section: "documents", label: "מסמכים" },
  { section: "clients", label: "ניהול לקוחות" },
  { section: "users", label: "ניהול משתמשים" },
];

const linkSecondaryClass =
  "rounded-lg px-3 py-2 text-start text-sm font-medium text-blue-700 outline-none hover:bg-blue-50/80 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2";

type AccountantWorkspaceProps = {
  showAdminLink: boolean;
  showClientLink: boolean;
};

export function AccountantWorkspace({
  showAdminLink,
  showClientLink,
}: AccountantWorkspaceProps) {
  const [active, setActive] = useState<Section>("documents");
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuId = useId();
  const drawerHeadingId = useId();

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  function select(section: Section) {
    setActive(section);
    closeMobile();
  }

  function MenuFooter({ mobile }: { mobile: boolean }) {
    const wrap = mobile ? "mt-4 border-t border-zinc-100 pt-4" : "";
    return (
      <div className={wrap}>
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            onClick={mobile ? closeMobile : undefined}
            className={linkSecondaryClass}
          >
            דף הבית
          </Link>
          <Link
            href="/settings/password"
            onClick={mobile ? closeMobile : undefined}
            className={linkSecondaryClass}
          >
            ניהול סיסמה
          </Link>
          {showAdminLink ? (
            <Link
              href="/admin"
              onClick={mobile ? closeMobile : undefined}
              className={linkSecondaryClass}
            >
              אדמין
            </Link>
          ) : null}
          {showClientLink ? (
            <Link
              href="/client"
              onClick={mobile ? closeMobile : undefined}
              className={linkSecondaryClass}
            >
              לקוח
            </Link>
          ) : null}
          <SignOutButton className="mt-2 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col lg:min-h-screen"
      dir="rtl"
    >
      {/* דסקטופ: תפריט קבוע בקצה ימין המסך (ב־RTL זה inline-start) */}
      <aside
        aria-label="ניווט אזור רואה החשבון"
        className="fixed inset-y-0 start-0 z-40 hidden w-52 flex-col border-e border-zinc-200 bg-zinc-50 xl:w-56 lg:flex"
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-8">
            <nav className="flex flex-col gap-1 px-0">
              {NAV.map(({ section, label }) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => select(section)}
                  aria-current={active === section ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-start text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
                    active === section
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                      : "text-zinc-700 hover:bg-zinc-100/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 py-4">
            <MenuFooter mobile={false} />
          </div>
        </div>
      </aside>

      {/* תוכן ראשי — מוזז כדי לא להיחתך תחת הסרגל הקבוע */}
      <div className="flex min-h-full min-w-0 flex-1 flex-col ps-0 lg:ps-52 xl:ps-56">
        <div className="sticky top-0 z-30 flex shrink-0 items-center border-b border-zinc-200 bg-white px-3 py-3 sm:px-4 lg:hidden">
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls={mobileMenuId}
            aria-haspopup="true"
            onClick={() => setMobileOpen(true)}
            className="touch-manipulation rounded-lg px-3 py-2 text-start outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <span className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <span aria-hidden className="text-zinc-500">
                ☰
              </span>
              אזור רואה חשבון
            </span>
          </button>
        </div>

        <main className="flex flex-1 flex-col gap-6 px-3 py-6 sm:gap-8 sm:px-4 sm:py-12">
          {active === "documents" ? (
            <AccountantDocumentsPanel />
          ) : active === "clients" ? (
            <AccountantClientsPanel />
          ) : (
            <AccountantUsersPlaceholderPanel />
          )}
        </main>
      </div>

      {mobileOpen ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 bg-zinc-900/50 lg:hidden"
            onClick={closeMobile}
          />
          <div
            id={mobileMenuId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={drawerHeadingId}
            className="fixed inset-y-0 start-0 z-50 flex w-[min(20rem,calc(100vw-3rem))] flex-col bg-white shadow-2xl ring-1 ring-black/10 lg:hidden"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
              <p
                id={drawerHeadingId}
                className="text-base font-semibold text-zinc-900"
              >
                אזור רואה חשבון
              </p>
              <button
                type="button"
                onClick={closeMobile}
                aria-label="סגירת תפריט"
                className="rounded-md p-2 text-xl leading-none text-zinc-600 hover:bg-zinc-100"
              >
                ×
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {NAV.map(({ section, label }) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => select(section)}
                  aria-current={active === section ? "page" : undefined}
                  className={`rounded-lg px-3 py-3 text-start text-sm font-medium ${
                    active === section
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-800 hover:bg-zinc-100"
                  }`}
                >
                  {label}
                </button>
              ))}
              <MenuFooter mobile />
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}
