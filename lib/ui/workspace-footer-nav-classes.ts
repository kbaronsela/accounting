/**
 * פריט יעד בתפריט צד התחתון (דף הבית, החלפת סיסמה, מעבר בין תפקידים —
 * בסגינד כמו שאר פריטי התפריט, ללא צביעה כחולה מיוחדת).
 */
export function workspaceFooterNavLinkClass(mobile: boolean): string {
  return mobile
    ? "rounded-lg px-3 py-3 text-start text-sm font-medium text-zinc-800 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2"
    : "rounded-lg px-3 py-2 text-start text-sm font-medium text-zinc-700 outline-none hover:bg-zinc-100/80 transition focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2";
}
