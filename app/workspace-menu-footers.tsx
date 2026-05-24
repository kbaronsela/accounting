"use client";

import Link from "next/link";
import { SignOutButton } from "@/app/admin/sign-out-button";
import { workspaceFooterNavLinkClass } from "@/lib/ui/workspace-footer-nav-classes";
import {
  NavIconBriefcase,
  NavIconClientUser,
  NavIconHome,
  NavIconKey,
  NavIconShieldAdmin,
  WorkspaceNavIconRow,
} from "@/lib/ui/workspace-nav-icons";

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
          <WorkspaceNavIconRow icon={<NavIconHome />}>דף הבית</WorkspaceNavIconRow>
        </Link>
        <Link
          href="/settings/password"
          onClick={mobile ? closeMobileNav : undefined}
          className={workspaceFooterNavLinkClass(mobile)}
        >
          <WorkspaceNavIconRow icon={<NavIconKey />}>
            החלפת סיסמה
          </WorkspaceNavIconRow>
        </Link>
        {showAdminLink ? (
          <Link
            href="/admin"
            onClick={mobile ? closeMobileNav : undefined}
            className={workspaceFooterNavLinkClass(mobile)}
          >
            <WorkspaceNavIconRow icon={<NavIconShieldAdmin />}>
              אדמין
            </WorkspaceNavIconRow>
          </Link>
        ) : null}
        {showClientLink ? (
          <Link
            href="/client"
            onClick={mobile ? closeMobileNav : undefined}
            className={workspaceFooterNavLinkClass(mobile)}
          >
            <WorkspaceNavIconRow icon={<NavIconClientUser />}>
              לקוח
            </WorkspaceNavIconRow>
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
          <WorkspaceNavIconRow icon={<NavIconHome />}>דף הבית</WorkspaceNavIconRow>
        </Link>
        <Link
          href="/settings/password"
          onClick={mobile ? closeMobileNav : undefined}
          className={workspaceFooterNavLinkClass(mobile)}
        >
          <WorkspaceNavIconRow icon={<NavIconKey />}>
            החלפת סיסמה
          </WorkspaceNavIconRow>
        </Link>
        {showAccountantLink ? (
          <Link
            href="/accountant"
            onClick={mobile ? closeMobileNav : undefined}
            className={workspaceFooterNavLinkClass(mobile)}
          >
            <WorkspaceNavIconRow icon={<NavIconBriefcase />}>
              רואה חשבון
            </WorkspaceNavIconRow>
          </Link>
        ) : null}
        {showClientLink ? (
          <Link
            href="/client"
            onClick={mobile ? closeMobileNav : undefined}
            className={workspaceFooterNavLinkClass(mobile)}
          >
            <WorkspaceNavIconRow icon={<NavIconClientUser />}>
              לקוח
            </WorkspaceNavIconRow>
          </Link>
        ) : null}
        <SignOutButton mobile={mobile} />
      </div>
    </div>
  );
}
