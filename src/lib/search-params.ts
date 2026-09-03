/**
 * Reading Next's `searchParams`, where a value may arrive as a string, as a repeated
 * parameter, or not at all.
 *
 * Repeated parameters are how multi-select filters travel: a `<select multiple>` serializes
 * `?status=a&status=b` on its own, so a filter that accepts several values reads
 * `listSearchParam` and one that accepts a single value reads `firstSearchParam`. Before
 * this existed roughly fifteen copies of the single-value helper had been written out by
 * hand, each page and domain module carrying its own.
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

  return [
    ...new Set(
      values.flatMap((entry) => {
        const trimmed = entry?.trim();

        return trimmed ? [trimmed] : [];
      }),
    ),
  ];
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
    params.getAll(key).filter((entry) => entry !== value),
  );
}
