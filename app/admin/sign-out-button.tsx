"use client";

import { signOut } from "next-auth/react";
import { workspaceFooterNavLinkClass } from "@/lib/ui/workspace-footer-nav-classes";

type SignOutButtonProps = {
  className?: string;
  /** תואם לפוטר דסקטופ / מגירת מובייל (אותו סגנון כמו שאר קישורי התפריט) */
  mobile?: boolean;
};

export function SignOutButton({
  className,
  mobile = false,
}: SignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.assign("/");
      }}
      className={[
        workspaceFooterNavLinkClass(mobile),
        "w-full cursor-pointer border-0 bg-transparent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      התנתקות
    </button>
  );
}
