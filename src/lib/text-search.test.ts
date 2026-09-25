import { describe, expect, it } from "vitest";

import { findFoldedMatch, foldForSearch, foldedIncludes } from "./text-search";

describe("foldForSearch", () => {
  it("lower-cases and strips Hungarian accents", () => {
    expect(foldForSearch("Árajánlat EGYEZTETÉS").folded).toBe("arajanlat egyeztetes");
    expect(foldForSearch("Őrült ütemű ír kód").folded).toBe("orult utemu ir kod");
  });

  it("maps every folded unit back to the source offset that produced it", () => {
    const { folded, indexMap } = foldForSearch("Éves");

    expect(folded).toBe("eves");
    // "É" is one source character, so every later offset stays aligned with the source.
    expect(indexMap).toEqual([0, 1, 2, 3]);
  });

  it("advances by the real width of an astral character", () => {
    const { folded, indexMap } = foldForSearch("a🙂b");

    expect(folded).toBe("a🙂b");
    // The emoji occupies two UTF-16 units, so "b" sits at 3 in the source.
    expect(indexMap[indexMap.length - 1]).toBe(3);
  });
});

describe("foldedIncludes", () => {
  it("finds accented text from an unaccented query", () => {
    expect(foldedIncludes("Árajánlat egyeztetés", "arajanlat")).toBe(true);
    expect(foldedIncludes("Kód review", "KOD")).toBe(true);
  });

  it("treats an empty query as matching everything", () => {
    expect(foldedIncludes("Sprint planning", "   ")).toBe(true);
  });

  it("still refuses a real mismatch", () => {
    expect(foldedIncludes("Sprint planning", "invoice")).toBe(false);
  });
});

describe("findFoldedMatch", () => {
  it("reports the range in source offsets, so a highlight lands on the typed characters", () => {
    const text = "Árajánlat egyeztetés";
    const match = findFoldedMatch(text, "arajanlat");

    expect(match).not.toBeNull();
    expect(text.slice(match!.start, match!.end)).toBe("Árajánlat");
  });

  it("keeps the offsets right when the accent is in the middle of the match", () => {
    const text = "Napi ütemezés";
    const match = findFoldedMatch(text, "utemez");

    expect(text.slice(match!.start, match!.end)).toBe("ütemez");
  });

  it("marks a word-start match, and a mid-word one", () => {
    expect(findFoldedMatch("Sprint planning", "plan")?.atWordStart).toBe(true);
    expect(findFoldedMatch("Sprint planning", "print")?.atWordStart).toBe(false);
    expect(findFoldedMatch("CI/CD pipeline", "cd")?.atWordStart).toBe(true);
  });

  it("returns null for an empty query rather than a zero-length match", () => {
    expect(findFoldedMatch("Sprint planning", "")).toBeNull();
    expect(findFoldedMatch("Sprint planning", "  ")).toBeNull();
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(findFoldedMatch("Sprint planning", "  sprint ")?.start).toBe(0);
  });
});
