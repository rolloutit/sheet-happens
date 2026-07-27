"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import type { ThemeContextValue, ThemeName, ThemeProviderProps } from "./ThemeProvider.types";

const defaultStorageKey = "theme";
const themeListeners = new Set<() => void>();
const fallbackContext: ThemeContextValue = {
  setTheme: () => undefined,
  theme: "dark",
};

const ThemeContext = createContext<ThemeContextValue>(fallbackContext);

function normalizeTheme(value: unknown, fallback: ThemeName): ThemeName {
  return value === "light" || value === "dark" ? value : fallback;
}

function readStoredTheme(storageKey: string, fallback: ThemeName): ThemeName {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    return normalizeTheme(window.localStorage.getItem(storageKey), fallback);
  } catch {
    return fallback;
  }
}

function applyTheme(theme: ThemeName) {
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(theme);
  document.documentElement.style.colorScheme = theme;
}

function notifyThemeListeners() {
  for (const listener of themeListeners) {
    listener();
  }
}

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);

  return () => {
    themeListeners.delete(listener);
  };
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = defaultStorageKey,
}: ThemeProviderProps) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    () => readStoredTheme(storageKey, defaultTheme),
    () => defaultTheme,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === storageKey) {
        notifyThemeListeners();
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [storageKey]);

  const setTheme = useCallback(
    (nextTheme: ThemeName) => {
      try {
        window.localStorage.setItem(storageKey, nextTheme);
      } catch {
        // The DOM theme still changes when storage is unavailable.
      }

      applyTheme(nextTheme);
      notifyThemeListeners();
    },
    [storageKey],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      setTheme,
      theme,
    }),
    [setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
