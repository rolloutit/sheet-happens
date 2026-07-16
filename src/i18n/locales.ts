export const supportedLocales = ["hu", "en"] as const;
export const defaultLocale = "hu";
export const localeCookieName = "sheet-happens-locale";

export type AppLocale = (typeof supportedLocales)[number];

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && supportedLocales.includes(value as AppLocale);
}

export function resolveLocale(value: unknown): AppLocale | null {
  return isSupportedLocale(value) ? value : null;
}

export function resolveLocaleFromAcceptLanguage(value: string | null): AppLocale | null {
  if (!value) return null;

  const requestedLocales = value
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase())
    .filter(Boolean);

  for (const requestedLocale of requestedLocales) {
    const language = requestedLocale?.split("-")[0];
    const locale = resolveLocale(requestedLocale) ?? resolveLocale(language);
    if (locale) return locale;
  }

  return null;
}
