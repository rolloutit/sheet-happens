import { describe, expect, it } from "vitest";

import {
  assertLeaveRangeShape,
  LEAVE_ATTACHMENT_MAX_BYTES,
  LeaveError,
  validateLeaveAttachment,
  validateLeaveInput,
} from "./leave-rules";

const base = {
  startDate: "2026-10-12",
  endDate: "2026-10-16",
  dayPart: "FULL" as const,
  holidayDates: ["2026-10-23"],
  earliestStartDate: "2026-10-01",
  existing: [],
};

function codeOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof LeaveError) return error.code;
    throw error;
  }
  return null;
}

describe("validateLeaveInput", () => {
  it("accepts a week in the current month and returns its workdays", () => {
    expect(validateLeaveInput(base)).toEqual({ workdays: 5, skippedHolidays: 0 });
  });

  it("rejects an end date before the start date", () => {
    expect(codeOf(() => validateLeaveInput({ ...base, endDate: "2026-10-11" }))).toBe(
      "INVALID_RANGE",
    );
  });

  it("allows a half day only on a single date", () => {
    expect(codeOf(() => validateLeaveInput({ ...base, dayPart: "MORNING" }))).toBe(
      "HALF_DAY_RANGE",
    );
    expect(
      validateLeaveInput({ ...base, endDate: "2026-10-12", dayPart: "AFTERNOON" }).workdays,
    ).toBe(0.5);
  });

  it("rejects a leave without a single workday in it", () => {
    expect(
      codeOf(() => validateLeaveInput({ ...base, startDate: "2026-10-23", endDate: "2026-10-25" })),
    ).toBe("NO_WORKDAYS");
  });

  it("rejects a start before the earliest allowed date, but not when there is none", () => {
    // Monday the 12th, so yesterday is the 11th.
    const tooEarly = {
      ...base,
      earliestStartDate: "2026-10-11",
      startDate: "2026-10-08",
      endDate: "2026-10-12",
    };

    expect(codeOf(() => validateLeaveInput(tooEarly))).toBe("BEFORE_YESTERDAY");
    expect(validateLeaveInput({ ...tooEarly, earliestStartDate: null }).workdays).toBe(3);
  });

  it("rejects dates that do not exist", () => {
    expect(codeOf(() => validateLeaveInput({ ...base, endDate: "2026-02-31" }))).toBe(
      "INVALID_RANGE",
    );
  });

  it("rejects an absurd range by arithmetic, before looking at a single day", () => {
    expect(
      codeOf(() =>
        assertLeaveRangeShape({
          startDate: "0001-01-01",
          endDate: "9999-12-31",
          dayPart: "FULL",
          earliestStartDate: null,
        }),
      ),
    ).toBe("TOO_LONG");
  });

  it("rejects a leave longer than a year", () => {
    expect(
      codeOf(() => validateLeaveInput({ ...base, startDate: "2026-10-01", endDate: "2027-10-02" })),
    ).toBe("TOO_LONG");
  });

  it("rejects an overlap with an existing leave, except the other half of the same day", () => {
    const existing = [
      { startDate: "2026-10-16", endDate: "2026-10-16", dayPart: "MORNING" as const },
    ];

    expect(codeOf(() => validateLeaveInput({ ...base, existing }))).toBe("OVERLAP");
    expect(
      validateLeaveInput({
        ...base,
        startDate: "2026-10-16",
        endDate: "2026-10-16",
        dayPart: "AFTERNOON",
        existing,
      }).workdays,
    ).toBe(0.5);
  });
});

describe("validateLeaveAttachment", () => {
  const pdf = Buffer.from("%PDF-1.7\nexample");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

  it.each([
    ["a PDF", pdf, "igazolas.pdf", "application/pdf"],
    ["a PNG", png, "photo.PNG", "image/png"],
    ["a JPEG", jpeg, "photo.jpeg", "image/jpeg"],
  ])("accepts %s", (_name, bytes, originalFilename, contentType) => {
    expect(
      validateLeaveAttachment({ bytes, originalFilename, contentType, byteSize: bytes.byteLength }),
    ).toBe(contentType);
  });

  it.each([
    ["empty", Buffer.alloc(0), "a.pdf", "application/pdf", 0, "ATTACHMENT_REQUIRED"],
    [
      "oversized",
      pdf,
      "a.pdf",
      "application/pdf",
      LEAVE_ATTACHMENT_MAX_BYTES + 1,
      "ATTACHMENT_TOO_LARGE",
    ],
    ["unsupported", Buffer.from("hello"), "a.txt", "text/plain", 5, "ATTACHMENT_TYPE"],
    ["mislabelled", Buffer.from("hello"), "a.pdf", "application/pdf", 5, "ATTACHMENT_TYPE"],
  ])("rejects an %s file", (_name, bytes, originalFilename, contentType, byteSize, code) => {
    expect(
      codeOf(() => validateLeaveAttachment({ bytes, originalFilename, contentType, byteSize })),
    ).toBe(code);
  });
});
