import { describe, expect, it } from "vitest";

import { anyOf } from "./any-of";

describe("anyOf", () => {
  it("returns nothing for no clauses, so the caller adds no filter", () => {
    expect(anyOf([])).toBeNull();
  });

  it("returns a lone clause unwrapped", () => {
    expect(anyOf([{ actorMemberId: null }])).toEqual({ actorMemberId: null });
  });

  it("wraps alternatives in OR", () => {
    expect(anyOf([{ a: 1 }, { b: 2 }])).toEqual({ OR: [{ a: 1 }, { b: 2 }] });
  });
});
