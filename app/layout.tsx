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
      {/*
        Only the two Lexend subsets are preloaded, and both unconditionally. `@font-face` rules in a
        stylesheet are not fetched until the browser has matched them against laid-out text, so the
        body typeface would otherwise arrive a layout pass late. `latin-ext` is not gated on the HU
        locale because Hungarian names and project titles carry ő/ű inside the EN UI too.

        Poppins is deliberately left to on-demand discovery: it only dresses `.font-ui` labels, and
        preloading four more weights would compete with Lexend for the same early bandwidth.

        `crossOrigin` is required even though these are same-origin — CSS fetches fonts in anonymous
        CORS mode, so a preload without it is a cache miss the browser silently fetches twice.
      */}
      <link
        rel="preload"
        href="/fonts/lexend-variable-latin.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href="/fonts/lexend-variable-latin-ext.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
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
