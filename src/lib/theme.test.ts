import { describe, expect, it } from "vitest";

import {
  defaultThemePreference,
  isResolvedTheme,
  isThemePreference,
  themePreferences,
  themeStorageKey,
} from "./theme";

describe("theme", () => {
  it("offers exactly light, dark and system", () => {
    expect(themePreferences).toEqual(["light", "dark", "system"]);
  });

  it("defaults to following the operating system", () => {
    expect(defaultThemePreference).toBe("system");
    expect(isThemePreference(defaultThemePreference)).toBe(true);
  });

  it("keeps the storage key next-themes and the previous provider both used", () => {
    expect(themeStorageKey).toBe("theme");
  });

  it.each(themePreferences)("accepts %s as a preference", (preference) => {
    expect(isThemePreference(preference)).toBe(true);
  });

  it.each([null, undefined, "", "Dark", "auto", 1, {}])("rejects %s as a preference", (value) => {
    expect(isThemePreference(value)).toBe(false);
  });

  it("treats system as a preference but never as a resolved theme", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isResolvedTheme("system")).toBe(false);
    expect(isResolvedTheme("light")).toBe(true);
    expect(isResolvedTheme("dark")).toBe(true);
  });
});
