import type { ReactNode } from "react";

import type { ResolvedTheme, ThemePreference } from "@/src/lib/theme";

export type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: ThemePreference;
  /** Overridden in Storybook so story runs do not inherit a developer's app preference. */
  storageKey?: string;
};

export type UseThemeResult = {
  preference: ThemePreference | undefined;
  resolvedTheme: ResolvedTheme | undefined;
  systemTheme: ResolvedTheme | undefined;
  setTheme: (theme: ThemePreference) => void;
};
