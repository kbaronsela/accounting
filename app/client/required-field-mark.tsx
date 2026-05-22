/** כוכבית חובה (ליד תוויות שדות) */
export function RequiredFieldMark() {
  return (
    <sup
      className="ms-1 translate-y-px text-base font-bold leading-none text-red-600"
      aria-hidden
    >
      *
    </sup>
  );
}
