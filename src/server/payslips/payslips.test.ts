import { describe, expect, it } from "vitest";

import {
  buildPayslipObjectKey,
  normalizeEmployeePayslipPage,
  normalizePayslipListFilters,
  PAYSLIP_MAX_BYTES,
  PayslipError,
  validatePayslipFile,
} from "./payslips";

const validPdf = Buffer.from("%PDF-1.7\nexample");

describe("payslip file policy", () => {
  it("accepts a bounded PDF with a matching signature", () => {
    expect(() =>
      validatePayslipFile({
        bytes: validPdf,
        originalFilename: "payslip.pdf",
        contentType: "application/pdf",
        byteSize: validPdf.byteLength,
      }),
    ).not.toThrow();
  });

  it.each([
    ["empty", Buffer.alloc(0), "payslip.pdf", "application/pdf", 0, "Payslip PDF is required."],
    [
      "oversized",
      validPdf,
      "payslip.pdf",
      "application/pdf",
      PAYSLIP_MAX_BYTES + 1,
      "Payslip PDF is too large.",
    ],
    [
      "wrong content type",
      validPdf,
      "payslip.pdf",
      "text/plain",
      validPdf.byteLength,
      "Payslip must be a PDF.",
    ],
    [
      "wrong extension",
      validPdf,
      "payslip.txt",
      "application/pdf",
      validPdf.byteLength,
      "Payslip must be a PDF.",
    ],
    [
      "wrong signature",
      Buffer.from("not a PDF"),
      "payslip.pdf",
      "application/pdf",
      9,
      "Payslip must be a PDF.",
    ],
  ])("rejects a %s file", (_name, bytes, originalFilename, contentType, byteSize, message) => {
    expect(() => validatePayslipFile({ bytes, originalFilename, contentType, byteSize })).toThrow(
      new PayslipError(message),
    );
  });
});

describe("payslip helpers", () => {
  it("uses an opaque key that identifies the employee and month without trusting the filename", () => {
    const key = buildPayslipObjectKey({
      employeeMemberId: "employee-1",
      periodStart: new Date("2026-08-27T12:00:00.000Z"),
      originalFilename: "August payslip (final).pdf",
    });

    expect(key).toMatch(/^payslips\/employee-1\/2026-08-01\/.+-August-payslip--final-.pdf$/);
  });

  it("normalizes bounded server-side list filters", () => {
    expect(
      normalizePayslipListFilters({
        employeeMemberId: " employee-1 ",
        month: "2026-08",
        query: "  Ada  ",
        page: "3",
        pageSize: "500",
      }),
    ).toEqual({
      employeeMemberId: "employee-1",
      month: "2026-08",
      query: "Ada",
      page: 3,
      pageSize: 100,
    });
  });

  it("drops malformed filter values", () => {
    expect(
      normalizePayslipListFilters({
        employeeMemberId: " ",
        month: "2026-13",
        query: " ",
        page: "0",
        pageSize: "nope",
      }),
    ).toEqual({
      employeeMemberId: null,
      month: null,
      query: "",
      page: 1,
      pageSize: 20,
    });
  });

  it("normalizes an employee history page", () => {
    expect(normalizeEmployeePayslipPage("4")).toBe(4);
    expect(normalizeEmployeePayslipPage("0")).toBe(1);
    expect(normalizeEmployeePayslipPage(["2"])).toBe(1);
  });
});
