"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

import type { ThemeProviderProps } from "./ThemeProvider.types";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
