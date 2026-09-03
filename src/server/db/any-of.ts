/**
 * Folds several alternative `where` clauses into one.
 *
 * Multi-select filters whose values do not share a single shape need this. The audit log's
 * `system` pseudo-actor matches rows with no actor at all, people's `locked` is a
 * soft-delete marker rather than a status, a project's `ungrouped` is the absence of a group
 * rather than one of them, and each project timeline is its own date comparison — so none of
 * them can join the `in` its siblings use, and "any of these" becomes an `OR`.
 *
 * A single clause is returned as-is rather than wrapped, which keeps both the generated SQL
 * and the shape the existing tests assert unchanged for the common one-value case.
 */
export function anyOf<Clause extends object>(clauses: Clause[]): Clause | { OR: Clause[] } | null {
  const [only] = clauses;

  if (!only) return null;

  return clauses.length === 1 ? only : { OR: clauses };
}
