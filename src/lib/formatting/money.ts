/**
 * Money formatting. Amounts arrive as decimal strings (Prisma `Decimal`), never as floats.
 */

export type MoneyDisplay = "symbol" | "code";

export type FormatMoneyOptions = {
  /**
   * `symbol` renders `€300.00`, `code` renders `300.00 EUR`.
   *
   * Timesheet and invoice screens use `code` because contractors reconcile them against
   * invoices that name the currency explicitly; the report PDF uses `symbol`.
   */
  display?: MoneyDisplay;
};

export function formatMoney(
  amount: string,
  currencyCode: string,
  locale: string,
  options: FormatMoneyOptions = {},
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: options.display ?? "symbol",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/** `100 EUR/h` — the currency code is always spelled out for rates. */
export function formatRate(hourlyRate: string, currencyCode: string, locale: string) {
  const formattedRate = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(Number(hourlyRate));

  return `${formattedRate} ${currencyCode}/h`;
}
