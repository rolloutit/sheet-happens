import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";

import "./globals.css";
import { ThemeProvider } from "@/src/components/layout/ThemeProvider";
import en from "@/messages/en.json";

export const metadata: Metadata = {
  title: "Sheet Happens",
  description: "Internal time tracking and timesheet workflow for Rollout IT.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale="en" messages={en}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
