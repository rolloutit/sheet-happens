import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";
import { useEffect, type ReactNode } from "react";

import "../app/globals.css";
import en from "../messages/en.json";
import hu from "../messages/hu.json";

const messages = { en, hu } as const;

function StorybookProviders({
  children,
  theme,
  locale,
}: {
  children: ReactNode;
  theme: "dark" | "light";
  locale: "en" | "hu";
}) {
  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
    document.documentElement.lang = locale;
  }, [theme, locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <div className={theme}>{children}</div>
    </NextIntlClientProvider>
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
        theme={context.globals.theme as "dark" | "light"}
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
