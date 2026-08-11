import { describe, expect, it } from "vitest";

import { commandFilter, foldText } from "./Command.filter";

describe("foldText", () => {
  it("strips every Hungarian accent, including the long umlauts", () => {
    expect(foldText("árvíztűrő tükörfúrógép")).toBe("arvizturo tukorfurogep");
    expect(foldText("ÁÉÍÓÖŐÚÜŰ")).toBe("aeiooouuu");
  });

  it("lowercases", () => {
    expect(foldText("Szabó Réka")).toBe("szabo reka");
  });
});

describe("commandFilter", () => {
  it("shows everything when the search is empty or blank", () => {
    expect(commandFilter("id-1", "", ["Marketing site"])).toBe(1);
    expect(commandFilter("id-1", "   ", ["Marketing site"])).toBe(1);
  });

  it("matches accent-insensitively in both directions", () => {
    expect(commandFilter("id-1", "arvizturo", ["Árvíztűrő"])).toBeGreaterThan(0);
    expect(commandFilter("id-1", "ÁRVÍZ", ["arvizturo"])).toBeGreaterThan(0);
  });

  it("ranks a prefix above a word start above a mid-word hit", () => {
    const prefix = commandFilter("id-1", "mark", ["Marketing site"]);
    const wordStart = commandFilter("id-2", "site", ["Marketing site"]);
    const midWord = commandFilter("id-3", "arket", ["Marketing site"]);

    expect(prefix).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(midWord);
    expect(midWord).toBeGreaterThan(0);
  });

  it("hides non-matches", () => {
    expect(commandFilter("id-1", "payroll", ["Marketing site"])).toBe(0);
  });

  /**
   * The reason this scorer exists. cmdk's default fuzzy filter matches scattered
   * characters, so `mks` would surface "Marketing site". A substring match will not.
   */
  it("does not match scattered characters the way a fuzzy scorer would", () => {
    expect(commandFilter("id-1", "mks", ["Marketing site"])).toBe(0);
  });

  /**
   * Option values in this app are opaque ids. Scoring them would make any query containing
   * a hex character match rows for a reason invisible to the user.
   */
  it("ignores the value when keywords are supplied", () => {
    expect(commandFilter("clx8h2k9a0000", "clx8", ["Marketing site"])).toBe(0);
  });

  it("falls back to the value when an item passes no keywords", () => {
    expect(commandFilter("Marketing site", "mark")).toBe(1);
    expect(commandFilter("Marketing site", "mark", [])).toBe(1);
  });

  it("searches every keyword, so secondary lines like an email still match", () => {
    const keywords = ["Szabó Réka", "reka.szabo@example.com"];

    expect(commandFilter("id-1", "example", keywords)).toBeGreaterThan(0);
    expect(commandFilter("id-1", "szabo", keywords)).toBeGreaterThan(0);
  });
});
