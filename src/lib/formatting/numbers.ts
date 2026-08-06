/** `1 234` — entry and people counts. Integers only, so fraction digits are pinned off. */
export function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}
