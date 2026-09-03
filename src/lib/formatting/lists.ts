/**
 * `Apollo, Helix és Belső` — the values of a multi-select filter, named in a header or a
 * chip rather than counted.
 *
 * `Intl.ListFormat` rather than `join(", ")` because the last separator is a word in both
 * locales the app ships ("and" / "és") and neither is punctuation. Kept here with the other
 * formatters so `Intl` stays the single authority; the PDF templates carry no locale logic.
 */
export function formatList(values: readonly string[], locale: string) {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(values);
}
