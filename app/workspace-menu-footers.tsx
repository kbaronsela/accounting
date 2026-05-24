"use client";

import Link from "next/link";
import { SignOutButton } from "@/app/admin/sign-out-button";
import { workspaceFooterNavLinkClass } from "@/lib/ui/workspace-footer-nav-classes";

export function AccountantWorkspaceMenuFooter({
  mobile,
  closeMobileNav,
  showAdminLink,
  showClientLink,
}: {
  mobile: boolean;
  /** נקרא בתפריט מובייל לפני ניווט לדף אחר */
  closeMobileNav?: () => void;
  showAdminLink: boolean;
  showClientLink: boolean;
}) {
  const wrap = mobile ? "mt-4 border-t border-zinc-100 pt-4" : "";
  return (
    <div className={wrap}>
      <div className="flex flex-col gap-1">
        <Link
          href="/"
          onClick={mobile ? closeMobileNav : undefined}
          className={workspaceFooterNavLinkClass(mobile)}
        >
          דף הבית
        </Link>
        <Link
          href="/settings/password"
          onClick={mobile ? closeMobileNav : undefined}
          className={workspaceFooterNavLinkClass(mobile)}
        >
          החלפת סיסמה
        </Link>
        {showAdminLink ? (
          <Link
            href="/admin"
            onClick={mobile ? closeMobileNav : undefined}
            className={workspaceFooterNavLinkClass(mobile)}
          >
            אדמין
          </Link>
        ) : null}
        {showClientLink ? (
          <Link
            href="/client"
            onClick={mobile ? closeMobileNav : undefined}
            className={workspaceFooterNavLinkClass(mobile)}
          >
            לקוח
          </Link>
        ) : null}
        <SignOutButton mobile={mobile} />
      </div>
    </div>
  );
}

export function AdminWorkspaceMenuFooter({
  mobile,
  closeMobileNav,
  showAccountantLink,
  showClientLink,
}: {
  mobile: boolean;
  /** נקרא בתפריט מובייל לפני מעבר בין דפים */
  closeMobileNav?: () => void;
  showAccountantLink: boolean;
  showClientLink: boolean;
}) {
  const wrap = mobile ? "mt-4 border-t border-zinc-100 pt-4" : "";
  return (
    <div className={wrap}>
      <div className="flex flex-col gap-1">
        <Link
          href="/"
          onClick={mobile ? closeMobileNav : undefined}
          className={workspaceFooterNavLinkClass(mobile)}
        >
          דף הבית
        </Link>
        <Link
          href="/settings/password"
          onClick={mobile ? closeMobileNav : undefined}
          className={workspaceFooterNavLinkClass(mobile)}
        >
          החלפת סיסמה
        </Link>
        {showAccountantLink ? (
          <Link
            href="/accountant"
            onClick={mobile ? closeMobileNav : undefined}
            className={workspaceFooterNavLinkClass(mobile)}
          >
            רואה חשבון
          </Link>
        ) : null}
        {showClientLink ? (
          <Link
            href="/client"
            onClick={mobile ? closeMobileNav : undefined}
            className={workspaceFooterNavLinkClass(mobile)}
          >
            לקוח
          </Link>
        ) : null}
        <SignOutButton mobile={mobile} />
      </div>
    </div>
  );
}
