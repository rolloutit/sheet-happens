"use client";

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

import {
  defaultThemePreference,
  isResolvedTheme,
  isThemePreference,
  themeStorageKey,
  type ThemePreference,
} from "@/src/lib/theme";
import type { ThemeProviderProps, UseThemeResult } from "./ThemeProvider.types";

export function ThemeProvider({
  children,
  defaultTheme = defaultThemePreference,
  storageKey = themeStorageKey,
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      enableColorScheme
      // Replaces the prototype's `html.theme-anim-off` + double-rAF trick: next-themes injects a
      // `* { transition: none !important }` style, flushes layout, then removes it next tick.
      disableTransitionOnChange
      storageKey={storageKey}
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * next-themes types `theme` and `resolvedTheme` as loose strings. Narrow them once here so this
 * folder stays the only module importing next-themes and no caller has to re-validate.
 */
export function useTheme(): UseThemeResult {
  const { resolvedTheme, setTheme, systemTheme, theme } = useNextTheme();

  return {
    /** What the user picked. `undefined` on the server and on the first client render. */
    preference: isThemePreference(theme) ? theme : undefined,
    /** What is actually painted. `undefined` on the server and on the first client render. */
    resolvedTheme: isResolvedTheme(resolvedTheme) ? resolvedTheme : undefined,
    systemTheme: isResolvedTheme(systemTheme) ? systemTheme : undefined,
    setTheme: (next: ThemePreference) => setTheme(next),
  };
}
