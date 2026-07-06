export type SelectOption = {
  value: string;
  label: string;
};

export type MemberPreferenceOptions = {
  currencies: readonly SelectOption[];
  timezones: readonly SelectOption[];
  locales: readonly SelectOption[];
};

const fallbackCurrencyCodes = ["EUR", "HUF", "USD", "GBP", "CHF"];
const fallbackTimeZones = ["Europe/Budapest", "Europe/London", "UTC"];
const preferredCurrencyCodes = ["EUR", "HUF", "USD", "GBP", "CHF"];
const preferredTimeZones = ["Europe/Budapest", "Europe/London", "UTC"];

export const localeOptions = [
  { value: "hu", label: "Hungarian" },
  { value: "en", label: "English" },
] as const satisfies readonly SelectOption[];

const supportedCurrencyCodes = getSupportedIntlValues("currency", fallbackCurrencyCodes);
const supportedTimeZones = getSupportedIntlValues("timeZone", fallbackTimeZones);
const supportedCurrencyCodeSet = new Set(supportedCurrencyCodes);
const supportedTimeZoneSet = new Set(supportedTimeZones);
const supportedLocaleSet: ReadonlySet<string> = new Set(
  localeOptions.map((option) => option.value),
);

export const currencyOptions = movePreferredValuesFirst(
  supportedCurrencyCodes,
  preferredCurrencyCodes,
).map((code) => ({
  value: code,
  label: `${code} - ${getCurrencyDisplayName(code)}`,
})) satisfies SelectOption[];

export const timezoneOptions = movePreferredValuesFirst(supportedTimeZones, preferredTimeZones).map(
  (timeZone) => ({
    value: timeZone,
    label: formatTimeZoneLabel(timeZone),
  }),
) satisfies SelectOption[];

export function getMemberPreferenceOptions(): MemberPreferenceOptions {
  return {
    currencies: currencyOptions,
    timezones: timezoneOptions,
    locales: localeOptions,
  };
}

export function normalizeCurrencyCode(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeTimeZone(value: string) {
  return value.trim();
}

export function normalizeLocale(value: string) {
  return value.trim().toLowerCase();
}

export function isSupportedCurrencyCode(value: string) {
  return supportedCurrencyCodeSet.has(normalizeCurrencyCode(value));
}

export function isSupportedTimeZone(value: string) {
  return supportedTimeZoneSet.has(normalizeTimeZone(value));
}

export function isSupportedLocale(value: string) {
  return supportedLocaleSet.has(normalizeLocale(value));
}

function getSupportedIntlValues(key: "currency" | "timeZone", fallback: string[]) {
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (input: "currency" | "timeZone") => string[];
  };

  try {
    return [...(intlWithSupportedValues.supportedValuesOf?.(key) ?? fallback)].sort();
  } catch {
    return [...fallback].sort();
  }
}

function movePreferredValuesFirst(values: string[], preferredValues: string[]) {
  const availableValues = new Set(values);
  const preferred = preferredValues.filter((value) => availableValues.has(value));
  const remaining = values.filter((value) => !preferredValues.includes(value));

  return [...preferred, ...remaining];
}

function getCurrencyDisplayName(currencyCode: string) {
  try {
    const displayNames = new Intl.DisplayNames(["en"], {
      type: "currency",
    });

    return displayNames.of(currencyCode) ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

function formatTimeZoneLabel(timeZone: string) {
  return timeZone.replaceAll("_", " ");
}
