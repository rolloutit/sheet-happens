import type { ReactNode } from "react";

export type ThemeName = "dark" | "light";

export type ThemeProviderProps = {
  attribute?: "class";
  children: ReactNode;
  defaultTheme?: ThemeName;
  enableSystem?: boolean;
  storageKey?: string;
};

export type ThemeContextValue = {
  setTheme: (theme: ThemeName) => void;
  theme: ThemeName;
};
