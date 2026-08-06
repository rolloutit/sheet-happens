import type { getTranslations } from "next-intl/server";

import {
  formatMoney as formatMoneyBase,
  formatPeriodRange as formatPeriodRangeBase,
  formatTimestamp as formatTimestampBase,
} from "@/src/lib/formatting";
import type { TimesheetPreviewStatus } from "@/src/server/timesheets";

type AdminTimesheetsTranslator = Awaited<ReturnType<typeof getTranslations>>;

export { formatCount, formatHours, formatMonthLabel, formatRate } from "@/src/lib/formatting";

/** Timesheet screens spell the currency out, because contractors reconcile these against invoices. */
export function formatMoney(amount: string, currencyCode: string, locale: string) {
  return formatMoneyBase(amount, currencyCode, locale, { display: "code" });
}

export function formatPeriodRange(start: string, end: string, locale: string) {
  return formatPeriodRangeBase(start, end, locale, { style: "short" });
}

export function formatTimestamp(value: string | null, locale: string) {
  return formatTimestampBase(value, locale);
}

export function getStatusLabel(status: string, t: AdminTimesheetsTranslator) {
  const key = status.toLowerCase();
  return t(`status.${key}`);
}

export function toTimesheetPreviewStatus(status: string) {
  return status.toLowerCase() as TimesheetPreviewStatus;
}

export function getActionResultMessage(result: string | undefined, t: AdminTimesheetsTranslator) {
  if (!result) return null;

  const knownResults = new Set([
    "approved",
    "rejected",
    "paid",
    "invalid",
    "notFound",
    "notAccepted",
    "reasonRequired",
    "invoiceAccepted",
    "invoiceRejected",
    "invoiceNotFound",
    "acceptedInvoiceNotFound",
    "invoiceReasonRequired",
    "invoicePackageIncomplete",
    "notInvoiced",
    "invoiceRevisionChanged",
    "notSubmitted",
    "notAllowed",
    "databaseUnavailable",
    "failed",
  ]);

  return knownResults.has(result) ? t(`actionResults.${result}`) : null;
}
