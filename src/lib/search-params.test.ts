import { describe, expect, it } from "vitest";

import {
  deleteSearchParamValue,
  firstSearchParam,
  formDataStrings,
  listSearchParam,
  setSearchParamList,
  uniqueValues,
} from "./search-params";

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

describe("setSearchParamList", () => {
  it("replaces every value rather than appending to them", () => {
    const params = new URLSearchParams("status=PAID&status=APPROVED&month=2026-06");

    setSearchParamList(params, "status", ["SUBMITTED", "REJECTED"]);

    expect(params.getAll("status")).toEqual(["SUBMITTED", "REJECTED"]);
    expect(params.get("month")).toBe("2026-06");
  });

  it("removes the parameter for an empty list", () => {
    const params = new URLSearchParams("status=PAID");

    setSearchParamList(params, "status", []);

    expect(params.has("status")).toBe(false);
  });

  it("skips blanks", () => {
    const params = new URLSearchParams();

    setSearchParamList(params, "status", [" PAID ", "  "]);

    expect(params.getAll("status")).toEqual(["PAID"]);
  });
});

describe("deleteSearchParamValue", () => {
  it("drops one value and leaves the rest applied", () => {
    const params = new URLSearchParams("status=PAID&status=APPROVED&q=ann");

    deleteSearchParamValue(params, "status", "PAID");

    expect(params.getAll("status")).toEqual(["APPROVED"]);
    expect(params.get("q")).toBe("ann");
  });

  it("drops the whole parameter without a value", () => {
    const params = new URLSearchParams("status=PAID&status=APPROVED");

    deleteSearchParamValue(params, "status");

    expect(params.has("status")).toBe(false);
  });

  /**
   * The value a chip carries has been through a normalizer, so a hand-edited URL that
   * padded it would otherwise survive the click and only vanish on a second one.
   */
  it("matches a value the URL padded with whitespace", () => {
    const params = new URLSearchParams("group=%20g1%20&group=g2");

    deleteSearchParamValue(params, "group", "g1");

    expect(params.getAll("group")).toEqual(["g2"]);
  });
});

describe("uniqueValues", () => {
  it("collapses duplicates left by a normalizer, keeping the first", () => {
    expect(uniqueValues(["SUBMITTED", "SUBMITTED", "PAID"])).toEqual(["SUBMITTED", "PAID"]);
  });
});

describe("formDataStrings", () => {
  it("reads every entry of a repeated field", () => {
    const formData = new FormData();

    formData.append("status", "SUBMITTED");
    formData.append("status", "REJECTED");

    expect(formDataStrings(formData, "status")).toEqual(["SUBMITTED", "REJECTED"]);
  });

  it("ignores a file entry, which is never a filter value", () => {
    const formData = new FormData();

    formData.append("status", "PAID");
    formData.append("status", new File(["x"], "x.txt"));

    expect(formDataStrings(formData, "status")).toEqual(["PAID"]);
  });
});
