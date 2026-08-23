export type AdminPayslipMonthOption = {
  value: string;
  label: string;
  shortLabel: string;
  yearLabel: string;
};

export const PAYSLIP_MONTH_PAGE_SIZE = 12;

export function getPayslipMonthOptions(
  locale: string,
  now: Date = new Date(),
): AdminPayslipMonthOption[] {
  const newestMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return buildMonthOptions(locale, newestMonth, 0, 24);
}

export function getPayslipMonthWindow(
  locale: string,
  newestMonth: string,
  page = 0,
): AdminPayslipMonthOption[] {
  return buildMonthOptions(
    locale,
    newestMonth,
    Math.max(0, page) * PAYSLIP_MONTH_PAGE_SIZE,
    PAYSLIP_MONTH_PAGE_SIZE,
  );
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

export function getPayslipMonthPage(newestMonth: string, targetMonth: string): number {
  const newest = parseMonth(newestMonth);
  const target = parseMonth(targetMonth);
  const distance =
    (newest.getUTCFullYear() - target.getUTCFullYear()) * 12 +
    newest.getUTCMonth() -
    target.getUTCMonth();

  return Math.max(0, Math.floor(distance / PAYSLIP_MONTH_PAGE_SIZE));
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
