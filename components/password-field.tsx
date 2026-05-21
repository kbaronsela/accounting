"use client";

import { useState } from "react";

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type">;

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

/**
 * שדה סיסמה עם כפתור להצגה/הסתרה תוכן (מקל טקסט/קוראי מסך).
 */
export function PasswordField({
  className = "",
  disabled,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`w-full rounded-md border border-zinc-300 py-2 ps-3 pe-10 text-sm text-zinc-900 outline-none transition-[border-color] focus:border-zinc-500 disabled:bg-zinc-100 disabled:opacity-60 ${className}`}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 end-2 flex size-9 items-center justify-center rounded text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 disabled:pointer-events-none disabled:opacity-40"
        aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        aria-pressed={visible}
        title={visible ? "הסתר סיסמה" : "הצג סיסמה"}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
