import { describe, expect, it } from "vitest";

import { formatElapsed } from "./elapsed";

describe("formatElapsed", () => {
  it("drops the hour segment below one hour", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(1_000)).toBe("0:01");
    expect(formatElapsed(59_000)).toBe("0:59");
    expect(formatElapsed(60_000)).toBe("1:00");
    expect(formatElapsed(3_599_000)).toBe("59:59");
  });

  it("widens to h:mm:ss from one hour", () => {
    expect(formatElapsed(3_600_000)).toBe("1:00:00");
    expect(formatElapsed(3_661_000)).toBe("1:01:01");
    expect(formatElapsed(36_000_000)).toBe("10:00:00");
  });

  it("truncates rather than rounds, so the label never runs ahead of the timer", () => {
    expect(formatElapsed(1_999)).toBe("0:01");
  });

  it("clamps a clock that reads behind the start time to zero", () => {
    expect(formatElapsed(-5_000)).toBe("0:00");
  });
});
