import { describe, expect, it } from "vitest";

import {
  currencyOptions,
  isSupportedCurrencyCode,
  isSupportedLocale,
  isSupportedTimeZone,
  localeOptions,
  normalizeCurrencyCode,
  normalizeLocale,
  timezoneOptions,
} from "./member-preferences";

describe("member preference options", () => {
  it("validates supported currency codes", () => {
    expect(normalizeCurrencyCode(" eur ")).toBe("EUR");
    expect(isSupportedCurrencyCode("EUR")).toBe(true);
    expect(isSupportedCurrencyCode("HUF")).toBe(true);
    expect(isSupportedCurrencyCode("ZZZ")).toBe(false);
    expect(currencyOptions.at(0)?.value).toBe("EUR");
  });

  it("validates supported time zones", () => {
    expect(isSupportedTimeZone("Europe/Budapest")).toBe(true);
    expect(isSupportedTimeZone("Definitely/Invalid")).toBe(false);
    expect(timezoneOptions.at(0)?.value).toBe("Europe/Budapest");
  });

  it("limits app locales to HU and EN", () => {
    expect(normalizeLocale(" HU ")).toBe("hu");
    expect(isSupportedLocale("hu")).toBe(true);
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("de")).toBe(false);
    expect(localeOptions.map((option) => option.value)).toEqual(["hu", "en"]);
  });
});
