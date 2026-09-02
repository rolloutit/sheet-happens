export const themePreferences = ["light", "dark", "system"] as const;
export const resolvedThemes = ["light", "dark"] as const;

export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = (typeof resolvedThemes)[number];

/**
 * Also next-themes' own default storage key, and the key the previous hand-rolled provider wrote,
 * so browsers that already stored a choice keep it across the migration.
 */
export const themeStorageKey = "theme";

/** No stored choice means follow the operating system. */
export const defaultThemePreference = "system" satisfies ThemePreference;

export function isThemePreference(value: unknown): value is ThemePreference {
  return themePreferences.includes(value as ThemePreference);
}

export function isResolvedTheme(value: unknown): value is ResolvedTheme {
  return resolvedThemes.includes(value as ResolvedTheme);
}
