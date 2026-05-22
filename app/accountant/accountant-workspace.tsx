"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { AccountantClientsPanel } from "./accountant-clients-panel";
import { AccountantDocumentsPanel } from "./accountant-documents-panel";
import { AccountantUsersPlaceholderPanel } from "./accountant-users-placeholder-panel";

type Section = "documents" | "clients" | "users";

const NAV: { section: Section; label: string }[] = [
  { section: "documents", label: "מסמכים" },
  { section: "clients", label: "ניהול תיקים" },
  { section: "users", label: "ניהול משתמשים" },
];

export function AccountantWorkspace() {
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

  return (
    <div
      className="mx-auto flex min-h-full max-w-6xl flex-1 flex-col lg:flex-row"
      dir="rtl"
    >
      <aside
        aria-label="ניווט אזור רואה החשבון"
        className="hidden shrink-0 border-zinc-200 bg-zinc-50 lg:flex lg:w-52 lg:flex-col lg:border-s lg:px-3 lg:py-8 xl:w-56"
      >
        <nav className="flex flex-col gap-1 px-2">
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
          <Link
            href="/"
            className="mt-4 rounded-lg px-3 py-2 text-start text-sm font-medium text-blue-700 hover:bg-blue-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            דף הבית
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
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
              <Link
                href="/"
                onClick={closeMobile}
                className="mt-auto rounded-lg border border-zinc-200 px-3 py-3 text-center text-sm font-medium text-blue-700 hover:bg-blue-50/80"
              >
                דף הבית
              </Link>
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}
