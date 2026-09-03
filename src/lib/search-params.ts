/**
 * Reading Next's `searchParams`, where a value may arrive as a string, as a repeated
 * parameter, or not at all.
 *
 * Repeated parameters are how multi-select filters travel: a `<select multiple>` serializes
 * `?status=a&status=b` on its own, so a filter that accepts several values reads
 * `listSearchParam` and one that accepts a single value reads `firstSearchParam`.
 *
 * The single-value reader had been written out by hand in roughly fifteen places. The admin
 * list pages and domain modules now import it from here; the auth and settings pages still
 * carry their own copies, which are worth folding in the next time they are touched.
 */
export type SearchParamValue = string | string[] | undefined;

/**
 * The first value, or `""`. Callers trim and validate — a month, an id and a free-text
 * query all want something different, and this stays the one thing they share.
 */
export function firstSearchParam(value: SearchParamValue): string {
  if (Array.isArray(value)) return value.at(0) ?? "";

  return value ?? "";
}

/**
 * Every value, trimmed, with blanks dropped and duplicates collapsed, in the order the URL
 * carried them.
 *
 * Unlike `firstSearchParam` this cleans up: a repeated parameter is assembled by a form or
 * hand-edited far more often than a single one, so `?status=&status=PAID&status=PAID` is a
 * shape every caller would otherwise have to defend against separately.
 */
export function listSearchParam(value: SearchParamValue): string[] {
  const values = Array.isArray(value) ? value : [value];

  return uniqueValues(
    values.flatMap((entry) => {
      const trimmed = entry?.trim();

      return trimmed ? [trimmed] : [];
    }),
  );
}

/**
 * Collapses duplicates, keeping the first occurrence.
 *
 * `listSearchParam` already does this on the raw values, but a caller that normalizes them
 * afterwards — upper-casing a status, capping a length — can turn two distinct URL values
 * into one, and a duplicate that reaches the UI becomes two chips sharing a React key.
 */
export function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/** `FormData` hands back files as well as strings; only the strings are filter values. */
export function formDataStrings(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}

/**
 * Replaces every value of one repeated parameter, dropping blanks.
 *
 * `set` followed by `append` would leave the first value duplicated and `set` alone would
 * keep only one, so writing a multi-value filter always means clearing the key first.
 */
export function setSearchParamList(
  params: URLSearchParams,
  key: string,
  values: readonly string[],
) {
  params.delete(key);

  for (const value of values) {
    const trimmed = value.trim();

    if (trimmed) params.append(key, trimmed);
  }
}

/**
 * Drops one value of a repeated parameter, or the whole parameter when no value is given —
 * which is what taking one chip off a multi-select filter needs.
 *
 * `URLSearchParams.delete` accepts a value as its second argument in current runtimes, but
 * not in every browser this app still renders in, so the rewrite happens by hand.
 */
export function deleteSearchParamValue(params: URLSearchParams, key: string, value?: string) {
  if (value === undefined) {
    params.delete(key);
    return;
  }

  setSearchParamList(
    params,
    key,
    // Trimmed on both sides: `setSearchParamList` stores values trimmed, and the value a
    // chip carries has been through a normalizer, so a hand-edited `?group=%20g1%20` would
    // otherwise never match the `g1` the chip offers to remove.
    params.getAll(key).filter((entry) => entry.trim() !== value.trim()),
  );
}
