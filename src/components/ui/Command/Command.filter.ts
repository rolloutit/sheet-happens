/**
 * Scoring for the command menu.
 *
 * cmdk's built-in `command-score` filter is fuzzy: it matches scattered characters, so
 * searching `sze` in a project list surfaces anything containing an s, a z and an e in that
 * order. For picking one known row out of a few hundred that is noise, not help. This
 * scorer is a plain substring match, ranked by where the hit lands.
 */

/**
 * Strips diacritics and lowercases, so `arvizturo` matches `árvíztűrő`.
 *
 * Hungarian needs this in both directions: the long-umlaut vowels `ő` and `ű` are awkward
 * to type on a non-Hungarian keyboard, and half the member and project names carry accents.
 * NFD splits an accented letter into its base plus a combining mark, which `\p{Diacritic}`
 * then removes — including U+030B, the combining double acute that `ő` and `ű` decompose to.
 */
export function foldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

/** Characters that start a new word for ranking purposes. */
const wordBoundaryPattern = /[\s\-_/(,.:]/;

/**
 * cmdk `filter` implementation, returning 0 (hidden) to 1 (best).
 *
 * Scores `keywords` in preference to `value`, because in this app an option's value is
 * usually an opaque id — a cuid or a project id. Scoring those means a query containing a
 * hex character matches half the list for reasons no one can see. Items that pass no
 * keywords fall back to `value`, which is the right behaviour when the value *is* the label.
 */
export function commandFilter(value: string, search: string, keywords?: string[]) {
  const needle = foldText(search.trim());
  if (!needle) return 1;

  const haystacks = (keywords?.length ? keywords : [value]).map(foldText).filter(Boolean);

  let best = 0;

  for (const haystack of haystacks) {
    const index = haystack.indexOf(needle);

    if (index < 0) continue;
    if (index === 0) return 1;

    const score = wordBoundaryPattern.test(haystack.charAt(index - 1)) ? 0.6 : 0.3;
    best = Math.max(best, score);
  }

  return best;
}
