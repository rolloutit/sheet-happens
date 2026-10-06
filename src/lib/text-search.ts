/**
 * Accent- and case-insensitive matching over text a member typed, with the index arithmetic a
 * highlight needs.
 *
 * A Hungarian keyboard is the reason this exists. Someone looking for `Árajánlat egyeztetés` types
 * `araj`, and a plain `includes` finds nothing — so the description suggestions on `/time` would
 * appear to have forgotten the entry the member made yesterday. Folding fixes the match, and then
 * creates the second problem this module solves: `"Á".normalize("NFD")` is two code units where the
 * source had one, so an index into the folded string is not an index into the string on screen.
 * `findFoldedMatch` therefore reports its range in **source** offsets, and `foldForSearch` keeps the
 * map that makes that possible.
 *
 * Not a search engine. It is `indexOf` with the two corrections a Latin-script European language
 * needs, and it is deliberately synchronous and allocation-cheap because it runs per option per
 * keystroke.
 */

/** Combining marks, i.e. what NFD splits an accented letter into. */
const COMBINING_MARKS = /\p{Diacritic}/gu;

/** Characters a match may start after and still count as starting a word. */
const WORD_BOUNDARY = /[\s\-–—/\\|(){}[\]:;,.!?"'`+*&@#]/;

export type FoldedText = {
  /** Lower-cased and stripped of diacritics. Same order as the source, rarely the same length. */
  folded: string;
  /** `indexMap[i]` is the offset in the source string that produced `folded[i]`. */
  indexMap: number[];
};

export type FoldedMatch = {
  /** Offsets into the **source** string, so a highlight can slice it directly. */
  start: number;
  end: number;
  /** The match starts the string, or follows a boundary — ranked above a mid-word hit. */
  atWordStart: boolean;
};

/**
 * Fold `text` for comparison and keep the offsets needed to map a result back onto it.
 *
 * Iterated by code point rather than by index so an emoji or any other astral character in a
 * description advances the source offset by its real UTF-16 width instead of splitting in half.
 */
export function foldForSearch(text: string): FoldedText {
  let folded = "";
  const indexMap: number[] = [];
  let sourceIndex = 0;

  for (const character of text) {
    const stripped = character.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();

    for (let offset = 0; offset < stripped.length; offset += 1) {
      indexMap.push(sourceIndex);
    }

    folded += stripped;
    sourceIndex += character.length;
  }

  return { folded, indexMap };
}

/** Whether `query` appears in `text`, ignoring case and accents. Empty queries match everything. */
export function foldedIncludes(text: string, query: string): boolean {
  if (!query.trim()) return true;

  return findFoldedMatch(text, query) !== null;
}

/**
 * The first place `query` appears in `text`, ignoring case and accents, in source offsets.
 *
 * `null` for no match and for an empty query — a caller showing "everything" for an empty field
 * wants no highlight, and treating that as a zero-length match at 0 would draw one.
 */
export function findFoldedMatch(text: string, query: string): FoldedMatch | null {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) return null;

  const { folded, indexMap } = foldForSearch(text);
  const needle = foldForSearch(trimmedQuery).folded;

  if (!needle) return null;

  const at = folded.indexOf(needle);

  if (at === -1) return null;

  return {
    start: indexMap[at],
    end: sourceEndOffset(text, indexMap, at + needle.length),
    atWordStart: at === 0 || WORD_BOUNDARY.test(folded[at - 1]),
  };
}

/**
 * The source offset just past a match that ends at `foldedEnd`.
 *
 * Walks forward to the first folded unit belonging to a *different* source character, because one
 * source character can fold to several units — and cutting between two of them would end the
 * highlight inside a character.
 */
function sourceEndOffset(text: string, indexMap: number[], foldedEnd: number) {
  const lastMatched = indexMap[foldedEnd - 1];

  for (let cursor = foldedEnd; cursor < indexMap.length; cursor += 1) {
    if (indexMap[cursor] !== lastMatched) return indexMap[cursor];
  }

  return text.length;
}
