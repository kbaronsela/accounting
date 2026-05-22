/** כוכבית חובה קטנה (ליד תוויות שדות) */
export function RequiredFieldMark() {
  return (
    <sup
      className="ms-1 text-[0.65rem] font-semibold leading-none text-red-600"
      aria-hidden
    >
      *
    </sup>
  );
}
