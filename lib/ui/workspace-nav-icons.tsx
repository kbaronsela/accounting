import type { ReactNode, SVGProps } from "react";

const svgAttrs = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type IconProps = SVGProps<SVGSVGElement>;

/** ב־RTL האייקון מימין והטקסט משמאל — האלמנט הראשון הוא האייקון */
export function WorkspaceNavIconRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <span
        aria-hidden
        className="inline-flex h-[1.15rem] w-[1.15rem] shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-start">{children}</span>
    </>
  );
}

export function NavIconHome(props: IconProps) {
  return (
    <svg {...svgAttrs} {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function NavIconDocument(props: IconProps) {
  return (
    <svg {...svgAttrs} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h8M8 17h8" />
    </svg>
  );
}

export function NavIconKey(props: IconProps) {
  return (
    <svg {...svgAttrs} {...props}>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.7 9.7" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

export function NavIconShieldAdmin(props: IconProps) {
  return (
    <svg {...svgAttrs} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

export function NavIconBriefcase(props: IconProps) {
  return (
    <svg {...svgAttrs} {...props}>
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export function NavIconClientUser(props: IconProps) {
  return (
    <svg {...svgAttrs} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 1 1 16 0" />
    </svg>
  );
}

export function NavIconPeople(props: IconProps) {
  return (
    <svg {...svgAttrs} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** דוחות — טבלה / תרשים עמודות */
export function NavIconReportTable(props: IconProps) {
  return (
    <svg {...svgAttrs} {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 14v6M12 10v10M17 8v12" />
    </svg>
  );
}

/** דלת פתוחה + חץ החוצה (התנתקות) */
export function NavIconDoorExit(props: IconProps) {
  return (
    <svg {...svgAttrs} {...props}>
      <path d="M11 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6v18z" />
      <path d="M15 8l6 6-6 6M21 14H9" />
    </svg>
  );
}
