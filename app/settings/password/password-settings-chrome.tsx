"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { ClientPortalShell } from "@/app/client/client-portal-shell";
import {
  AccountantWorkspaceMenuFooter,
  AdminWorkspaceMenuFooter,
} from "@/app/workspace-menu-footers";

export type PasswordSettingsWorkspace = "client" | "accountant" | "admin";

function AccountantPasswordChrome({
  children,
  showAdminLink,
  showClientLink,
}: {
  children: React.ReactNode;
  showAdminLink: boolean;
  showClientLink: boolean;
}) {
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

  const navLinkDesk =
    "rounded-lg px-3 py-2 text-start text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2 text-zinc-700 hover:bg-teal-50/60";

  const navLinkMobile =
    "rounded-lg px-3 py-3 text-start text-sm font-medium text-zinc-800 hover:bg-teal-50/60";

  return (
    <div
      className="relative flex min-h-full w-full flex-1 flex-col lg:min-h-screen"
      dir="rtl"
    >
      <aside
        aria-label="ניווט אזור רואה החשבון"
        className="fixed inset-y-0 start-0 z-40 hidden w-52 flex-col border-e border-teal-200/80 bg-gradient-to-b from-teal-50 via-white to-emerald-50/90 shadow-[inset_-1px_0_0_0_rgb(167_243_208_/_0.35)] xl:w-56 lg:flex"
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-8">
            <nav className="flex flex-col gap-1 px-0">
              <Link href="/accountant" className={navLinkDesk}>
                מסמכים
              </Link>
              <Link
                href="/accountant?section=clients"
                className={navLinkDesk}
              >
                ניהול לקוחות
              </Link>
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
          {children}
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
              <Link
                href="/accountant"
                onClick={closeMobile}
                className={navLinkMobile}
              >
                מסמכים
              </Link>
              <Link
                href="/accountant?section=clients"
                onClick={closeMobile}
                className={navLinkMobile}
              >
                ניהול לקוחות
              </Link>
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

function AdminPasswordChrome({
  children,
  showAccountantLink,
  showClientLink,
}: {
  children: React.ReactNode;
  showAccountantLink: boolean;
  showClientLink: boolean;
}) {
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

  const deskNavBtn =
    "rounded-lg px-3 py-2 text-start text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2 bg-white text-teal-900 shadow-md shadow-teal-900/10 ring-1 ring-teal-200";

  const mobileNavBtn =
    "rounded-lg bg-gradient-to-bl from-teal-700 to-emerald-800 px-3 py-3 text-start text-sm font-semibold text-white shadow-md shadow-teal-900/25";

  return (
    <div
      className="relative flex min-h-full w-full flex-1 flex-col lg:min-h-screen"
      dir="rtl"
    >
      <aside
        aria-label="ניווט אזור אדמין"
        className="fixed inset-y-0 start-0 z-40 hidden w-52 flex-col border-e border-teal-200/80 bg-gradient-to-b from-teal-50 via-white to-emerald-50/90 shadow-[inset_-1px_0_0_0_rgb(167_243_208_/_0.35)] xl:w-56 lg:flex"
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-8">
            <nav className="flex flex-col gap-1 px-0">
              <Link href="/admin" className={deskNavBtn}>
                ניהול רואי חשבון
              </Link>
            </nav>
          </div>
          <div className="shrink-0 border-t border-teal-200/70 bg-teal-50/40 px-3 py-4 backdrop-blur-[2px]">
            <AdminWorkspaceMenuFooter
              mobile={false}
              showAccountantLink={showAccountantLink}
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
              אזור אדמין
            </span>
          </button>
        </div>

        <main className="flex flex-1 flex-col gap-6 px-3 py-6 sm:gap-8 sm:px-4 sm:py-12">
          {children}
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
                אזור אדמין
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
              <Link
                href="/admin"
                onClick={closeMobile}
                className={mobileNavBtn}
              >
                ניהול רואי חשבון
              </Link>
              <AdminWorkspaceMenuFooter
                mobile
                closeMobileNav={closeMobile}
                showAccountantLink={showAccountantLink}
                showClientLink={showClientLink}
              />
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function PasswordSettingsChrome({
  workspace,
  showAdminLink,
  /** לקוח: האם להראות קישור לרו״ח בפוטר */
  showAccountantLink,
  /** רו״ח/אדמין: האם להראות קישור ללקוח בפוטר */
  showClientLinkToWorkspace,
  children,
}: {
  workspace: PasswordSettingsWorkspace;
  showAdminLink: boolean;
  showAccountantLink: boolean;
  showClientLinkToWorkspace: boolean;
  children: React.ReactNode;
}) {
  if (workspace === "client") {
    return (
      <ClientPortalShell
        showAdminLink={showAdminLink}
        showAccountantLink={showAccountantLink}
      >
        {children}
      </ClientPortalShell>
    );
  }
  if (workspace === "accountant") {
    return (
      <AccountantPasswordChrome
        showAdminLink={showAdminLink}
        showClientLink={showClientLinkToWorkspace}
      >
        {children}
      </AccountantPasswordChrome>
    );
  }
  return (
    <AdminPasswordChrome
      showAccountantLink={showAccountantLink}
      showClientLink={showClientLinkToWorkspace}
    >
      {children}
    </AdminPasswordChrome>
  );
}
