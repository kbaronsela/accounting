/** כוכבית חובה (ליד תוויות שדות) — מיושרת לגובה מרכז שורת הטקסט */
export function RequiredFieldMark() {
  return (
    <span
      className="ms-1 inline-flex h-[1lh] shrink-0 items-center self-center align-middle leading-none"
      aria-hidden
    >
      <span className="text-[1.125em] font-bold leading-none text-red-600">*</span>
    </span>
  );
}
