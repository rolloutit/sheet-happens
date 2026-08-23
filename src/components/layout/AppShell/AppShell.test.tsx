import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import en from "@/messages/en.json";
import hu from "@/messages/hu.json";
import { ThemeProvider } from "../ThemeProvider";
import { AppShell } from ".";

function renderShell({
  current = "dashboard",
  locale = "en",
  profile,
}: {
  current?: string;
  locale?: "en" | "hu";
  profile?: "employee" | "contractor";
} = {}) {
  const messages = locale === "hu" ? hu : en;

  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <AppShell current={current} role="admin" profile={profile}>
          <p>content</p>
        </AppShell>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

describe("AppShell theme control placement", () => {
  it("puts the theme control in the desktop header next to the language toggle", () => {
    renderShell();

    const languageToggle = screen.getByRole("radiogroup", { name: "Language" });
    const cluster = languageToggle.parentElement as HTMLElement;

    expect(within(cluster).getByRole("button", { name: "Theme" })).toBeInTheDocument();
    expect(languageToggle.nextElementSibling).toHaveAccessibleName("Theme");
  });

  it("puts language and theme in the mobile drawer footer", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByRole("radiogroup", { name: "Language" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Theme" })).toBeInTheDocument();
  });
});

describe("AppShell account menu", () => {
  it("keeps account actions available from the mobile header", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "User menu" }));

    expect(await screen.findByText("My rates")).toBeInTheDocument();
    expect(screen.getByText("Profile and settings")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });
});

describe("AppShell page scope", () => {
  it.each([
    { current: "review", expected: "Admin" },
    { current: "reports", expected: "Admin" },
    { current: "dashboard", expected: "Everyone" },
    { current: "time", expected: "Everyone" },
    { current: "timesheets", profile: "contractor" as const, expected: "Contractor" },
    { current: "payslips", profile: "employee" as const, expected: "Employee" },
  ])("shows $expected for the $current page", ({ current, profile, expected }) => {
    renderShell({ current, profile });

    expect(screen.getByTestId("app-shell-page-scope")).toHaveTextContent(expected);
  });

  it("uses the localized page scope", () => {
    renderShell({ current: "dashboard", locale: "hu" });
    expect(screen.getByTestId("app-shell-page-scope")).toHaveTextContent("Mindenki");
  });
});
