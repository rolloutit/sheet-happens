import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import {
  defaultLocale,
  localeCookieName,
  resolveLocale,
  resolveLocaleFromAcceptLanguage,
} from "./locales";

export default getRequestConfig(async () => {
  const [requestCookies, requestHeaders] = await Promise.all([cookies(), headers()]);
  const locale =
    resolveLocale(requestCookies.get(localeCookieName)?.value) ??
    resolveLocaleFromAcceptLanguage(requestHeaders.get("accept-language")) ??
    defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
