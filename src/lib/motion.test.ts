import { describe, expect, it } from "vitest";

import {
  DURATION_LEVEL,
  EASE_STANDARD,
  STAGGER_CAP,
  STAGGER_ENTRY,
  dayLayoutId,
  entryEnterTransition,
  entryLayoutId,
  entryStaggerDelay,
} from "./motion";

describe("motion tokens", () => {
  /**
   * The literals here mirror the motion tokens in `app/globals.css`, which Motion cannot read
   * because it animates outside CSS. This asserts the mirror rather than the values: milliseconds
   * there, seconds here, and nothing else.
   */
  it("mirrors the CSS token table in seconds", () => {
    expect(DURATION_LEVEL * 1000).toBe(260);
    expect(STAGGER_ENTRY * 1000).toBe(18);
    expect(EASE_STANDARD).toEqual([0.2, 0.7, 0.2, 1]);
  });
});

describe("entryStaggerDelay", () => {
  it("steps one card at a time up to the cap", () => {
    expect(entryStaggerDelay(0)).toBe(0);
    expect(entryStaggerDelay(1)).toBeCloseTo(STAGGER_ENTRY);
    expect(entryStaggerDelay(7)).toBeCloseTo(7 * STAGGER_ENTRY);
  });

  /** §9's arithmetic: 40 cards at 18ms each would be 720ms of drizzle. */
  it("holds every card past the cap at the cap, so a dense column cannot drizzle", () => {
    const capped = entryStaggerDelay(STAGGER_CAP - 1);

    expect(entryStaggerDelay(STAGGER_CAP)).toBe(capped);
    expect(entryStaggerDelay(39)).toBe(capped);
    expect(capped).toBeLessThan(0.2);
  });

  it("keeps the cascade in reading order", () => {
    const delays = Array.from({ length: 20 }, (_, index) => entryStaggerDelay(index));

    expect(delays).toEqual([...delays].sort((a, b) => a - b));
  });

  it("survives an index it should never be given", () => {
    expect(entryStaggerDelay(-3)).toBe(0);
  });
});

describe("entryEnterTransition", () => {
  it("carries the stagger as the delay and nothing else", () => {
    expect(entryEnterTransition(2)).toEqual({
      duration: expect.any(Number),
      ease: EASE_STANDARD,
      delay: entryStaggerDelay(2),
    });
  });
});

describe("layout ids", () => {
  it("names a day and an entry distinctly", () => {
    expect(dayLayoutId("2026-09-02")).toBe("day-2026-09-02");
    expect(entryLayoutId("entry-1")).toBe("entry-entry-1");
    expect(dayLayoutId("2026-09-02")).not.toBe(entryLayoutId("2026-09-02"));
  });
});
