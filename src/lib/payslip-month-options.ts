import {
  addUtcMonths,
  dateValueToMonthValue,
  todayDateValue,
  toMonthValue,
} from "@/src/lib/date-values";

export type AdminPayslipMonthOption = {
  value: string;
  label: string;
  shortLabel: string;
  yearLabel: string;
};

const MONTHS_PER_YEAR = 12;

export function getPayslipMonthOptions(
  locale: string,
  now: Date = new Date(),
  timeZone = "UTC",
): AdminPayslipMonthOption[] {
  return buildMonthOptions(locale, currentMonthValue(now, timeZone), 0, 24);
}

/** Payslips are issued for the month before: in October the admin uploads September's. */
export function getDefaultPayslipMonth(now: Date = new Date(), timeZone = "UTC"): string {
  return toMonthValue(addUtcMonths(parseMonth(currentMonthValue(now, timeZone)), -1));
}

function currentMonthValue(now: Date, timeZone: string): string {
  return dateValueToMonthValue(todayDateValue(timeZone, now));
}

export function getPayslipMonthWindow(
  locale: string,
  currentMonth: string,
  page = 0,
): AdminPayslipMonthOption[] {
  const current = parseMonth(currentMonth);
  const year = current.getUTCFullYear() - page;

  return buildCalendarYearOptions(locale, year);
}

function buildMonthOptions(
  locale: string,
  newestMonth: string,
  offset: number,
  count: number,
): AdminPayslipMonthOption[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const shortFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const currentMonth = parseMonth(newestMonth);

  return Array.from({ length: count }, (_, index) => {
    const month = new Date(currentMonth);
    month.setUTCMonth(month.getUTCMonth() - offset - index);
    const yearLabel = String(month.getUTCFullYear());
    const value = `${yearLabel}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;

    return {
      value,
      label: formatter.format(month),
      shortLabel: shortFormatter.format(month),
      yearLabel,
    };
  });
}

export function getPayslipYearPage(currentMonth: string, targetMonth: string): number {
  const current = parseMonth(currentMonth);
  const target = parseMonth(targetMonth);

  return current.getUTCFullYear() - target.getUTCFullYear();
}

function buildCalendarYearOptions(locale: string, year: number): AdminPayslipMonthOption[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const shortFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const yearLabel = String(year);

  return Array.from({ length: MONTHS_PER_YEAR }, (_, monthIndex) => {
    const month = new Date(Date.UTC(year, monthIndex, 1));

    return {
      value: `${yearLabel}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: formatter.format(month),
      shortLabel: shortFormatter.format(month),
      yearLabel,
    };
  });
}

function parseMonth(value: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`Invalid month value: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month value: ${value}`);
  }

  return new Date(Date.UTC(year, month - 1, 1));
}
