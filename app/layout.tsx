import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import "./globals.css";
import { ThemeProvider } from "@/src/components/layout/ThemeProvider";

export const metadata: Metadata = {
  title: "Sheet Happens",
  description: "Internal time tracking and timesheet workflow for Rollout IT.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    /*
      `dark` here is the server-render baseline rather than a fixed theme: `:root` in globals.css
      holds the dark token values, and AuthShell/AuthForm carry `dark:` utilities whose base branch
      is light, so un-classed markup would paint a light panel for one frame. next-themes' blocking
      script rewrites the class from the stored preference before first paint, which is exactly the
      difference `suppressHydrationWarning` covers. Keeping it a constant also means the
      `router.refresh()` on language change cannot clobber what the script wrote.
    */
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body>
        {/* Outermost, so the blocking script is the first node in <body>. */}
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
