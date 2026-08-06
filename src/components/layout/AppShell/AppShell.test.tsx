import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import en from "@/messages/en.json";
import { ThemeProvider } from "../ThemeProvider";
import { AppShell } from ".";

function renderShell() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ThemeProvider>
        <AppShell current="dashboard" role="admin">
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
