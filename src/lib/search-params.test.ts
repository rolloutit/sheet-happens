import { describe, expect, it } from "vitest";

import { firstSearchParam, listSearchParam } from "./search-params";

describe("firstSearchParam", () => {
  it("reads a single value", () => {
    expect(firstSearchParam("PAID")).toBe("PAID");
  });

  it("keeps only the first of a repeated parameter", () => {
    expect(firstSearchParam(["PAID", "APPROVED"])).toBe("PAID");
  });

  it("falls back to an empty string", () => {
    expect(firstSearchParam(undefined)).toBe("");
    expect(firstSearchParam([])).toBe("");
  });
});

describe("listSearchParam", () => {
  it("reads a repeated parameter in URL order", () => {
    expect(listSearchParam(["SUBMITTED", "REJECTED"])).toEqual(["SUBMITTED", "REJECTED"]);
  });

  it("promotes a single value to a list", () => {
    expect(listSearchParam("SUBMITTED")).toEqual(["SUBMITTED"]);
  });

  it("drops blanks and collapses duplicates", () => {
    expect(listSearchParam([" PAID ", "", "PAID", "  "])).toEqual(["PAID"]);
  });

  it("returns nothing for an absent parameter", () => {
    expect(listSearchParam(undefined)).toEqual([]);
    expect(listSearchParam("")).toEqual([]);
  });
});
