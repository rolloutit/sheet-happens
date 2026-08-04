import type { getTranslations } from "next-intl/server";

import type { TimesheetPreviewStatus } from "@/src/server/timesheets";

type AdminTimesheetsTranslator = Awaited<ReturnType<typeof getTranslations>>;

export function formatHours(minutes: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(minutes / 60);
}

export function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatMoney(amount: string, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatRate(hourlyRate: string, currencyCode: string, locale: string) {
  const formattedRate = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(Number(hourlyRate));

  return `${formattedRate} ${currencyCode}/h`;
}

export function formatMonthLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatPeriodRange(start: string, end: string, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return `${formatter.format(new Date(`${start}T00:00:00.000Z`))} - ${formatter.format(
    new Date(`${end}T00:00:00.000Z`),
  )}`;
}

export function formatTimestamp(value: string | null, locale: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
