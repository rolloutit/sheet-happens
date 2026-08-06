import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { sb } from "storybook/test";

import "../app/globals.css";
import { ThemeProvider, useTheme } from "../src/components/layout/ThemeProvider";
import type { ThemePreference } from "../src/lib/theme";
import en from "../messages/en.json";
import hu from "../messages/hu.json";

/**
 * `AppShell` imports `setLocaleAction`, which is the documented Next.js way for a Client Component
 * to reach a Server Function — but `@storybook/nextjs-vite` ships no `"use server"` transform, so
 * Vite bundles the real module and follows it to Prisma → `pg` → `Buffer`. The redirect target is
 * `src/i18n/__mocks__/actions.ts`; a mock file rather than a bare automock, because automocked
 * modules are still evaluated together with their dependencies.
 *
 * The path must stay relative to this file, carry its `.ts` extension, and must not use the `@/`
 * alias — Storybook resolves it with `require.resolve` against this config's own directory.
 */
sb.mock(import("../src/i18n/actions.ts"));

const messages = { en, hu } as const;

/**
 * next-themes reads `defaultTheme` once, so the toolbar global has to be pushed in. Only push when
 * the global itself changes — reconciling on every mismatch would immediately undo a theme a story
 * sets for itself, which is exactly what ThemeToggle's play test does.
 */
function ThemeSync({ preference }: { preference: ThemePreference }) {
  const { setTheme } = useTheme();
  const lastPushed = useRef<ThemePreference>(undefined);

  useEffect(() => {
    if (lastPushed.current === preference) return;

    lastPushed.current = preference;
    setTheme(preference);
  }, [preference, setTheme]);

  return null;
}

function StorybookProviders({
  children,
  theme,
  locale,
}: {
  children: ReactNode;
  theme: ThemePreference;
  locale: "en" | "hu";
}) {
  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    if (theme !== "system") document.documentElement.classList.add(theme);
    document.documentElement.lang = locale;
  }, [theme, locale]);

  return (
    // A Storybook-only storage key keeps story runs from inheriting the app's saved preference.
    <ThemeProvider defaultTheme={theme} storageKey="storybook-theme">
      <ThemeSync preference={theme} />
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        <div className={theme === "system" ? undefined : theme}>{children}</div>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      defaultValue: "dark",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
          { value: "system", title: "System" },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: "Locale",
      defaultValue: "en",
      toolbar: {
        title: "Locale",
        icon: "globe",
        items: [
          { value: "en", title: "English" },
          { value: "hu", title: "Magyar" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => (
      <StorybookProviders
        theme={context.globals.theme as ThemePreference}
        locale={context.globals.locale as "en" | "hu"}
      >
        <Story />
      </StorybookProviders>
    ),
  ],
  parameters: {
    a11y: {
      test: "todo",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
