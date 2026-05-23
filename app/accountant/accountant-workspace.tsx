"use client";

import { AccountantWorkspaceMenuFooter } from "@/app/workspace-menu-footers";
import { useCallback, useEffect, useId, useState } from "react";
import { AccountantClientsPanel } from "./accountant-clients-panel";
import { AccountantDocumentsPanel } from "./accountant-documents-panel";

export type AccountantWorkspaceSection = "documents" | "clients";

type Section = AccountantWorkspaceSection;

const NAV: { section: Section; label: string }[] = [
  { section: "documents", label: "מסמכים" },
  { section: "clients", label: "ניהול לקוחות" },
];

type AccountantWorkspaceProps = {
  showAdminLink: boolean;
  showClientLink: boolean;
  /** מקור ראשוני מ־URL ‎`/accountant?section=clients`‎ */
  initialSection?: Section;
};

export function AccountantWorkspace({
  showAdminLink,
  showClientLink,
  initialSection = "documents",
}: AccountantWorkspaceProps) {
  const [active, setActive] = useState<Section>(() => initialSection);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuId = useId();
  const drawerHeadingId = useId();

  useEffect(() => {
    setActive(initialSection);
  }, [initialSection]);

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
      className="relative flex min-h-full flex-1 flex-col lg:min-h-screen"
      dir="rtl"
    >
      <aside
        aria-label="ניווט אזור רואה החשבון"
        className="fixed inset-y-0 start-0 z-40 hidden w-52 flex-col border-e border-teal-200/80 bg-gradient-to-b from-teal-50 via-white to-emerald-50/90 shadow-[inset_-1px_0_0_0_rgb(167_243_208_/_0.35)] xl:w-56 lg:flex"
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
                  className={`rounded-lg px-3 py-2 text-start text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2 ${
                    active === section
                      ? "bg-white font-semibold text-teal-900 shadow-md shadow-teal-900/10 ring-1 ring-teal-200"
                      : "text-zinc-700 hover:bg-teal-50/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="shrink-0 border-t border-teal-200/70 bg-teal-50/40 px-3 py-4 backdrop-blur-[2px]">
            <AccountantWorkspaceMenuFooter
              mobile={false}
              showAdminLink={showAdminLink}
              showClientLink={showClientLink}
            />
          </div>
        </div>
      </aside>

      <div className="flex min-h-full min-w-0 flex-1 flex-col ps-0 lg:ps-52 xl:ps-56">
        <div className="sticky top-0 z-30 flex shrink-0 items-center border-b border-teal-100/90 bg-white/90 px-3 py-3 shadow-sm shadow-teal-900/5 backdrop-blur-sm sm:px-4 lg:hidden">
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls={mobileMenuId}
            aria-haspopup="true"
            onClick={() => setMobileOpen(true)}
            className="touch-manipulation rounded-lg px-3 py-2 text-start outline-none hover:bg-teal-50/60 focus-visible:ring-2 focus-visible:ring-teal-400/60"
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
          ) : (
            <AccountantClientsPanel />
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
                      ? "bg-gradient-to-bl from-teal-700 to-emerald-800 font-semibold text-white shadow-md shadow-teal-900/25"
                      : "text-zinc-800 hover:bg-teal-50/60"
                  }`}
                >
                  {label}
                </button>
              ))}
              <AccountantWorkspaceMenuFooter
                mobile
                closeMobileNav={closeMobile}
                showAdminLink={showAdminLink}
                showClientLink={showClientLink}
              />
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}
