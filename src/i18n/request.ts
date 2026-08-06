import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import {
  defaultLocale,
  localeCookieName,
  resolveLocale,
  resolveLocaleFromAcceptLanguage,
} from "./locales";

export default getRequestConfig(async ({ requestLocale }) => {
  const [requested, requestCookies, requestHeaders] = await Promise.all([
    requestLocale,
    cookies(),
    headers(),
  ]);
  // An explicitly requested locale wins over the request's own: `getTranslations({ locale })` has to
  // be able to translate into another language than the caller is reading, or the report PDF export
  // could format its numbers and dates for the chosen language while its labels stayed behind.
  const locale =
    resolveLocale(requested) ??
    resolveLocale(requestCookies.get(localeCookieName)?.value) ??
    resolveLocaleFromAcceptLanguage(requestHeaders.get("accept-language")) ??
    defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
