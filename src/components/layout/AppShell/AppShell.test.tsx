import { render, screen, waitFor, within } from "@testing-library/react";
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
import type { AppShellTimer } from ".";

function renderShell({
  current = "dashboard",
  locale = "en",
  profile,
  timer,
  onStopTimer,
  onUserAction,
}: {
  current?: string;
  locale?: "en" | "hu";
  profile?: "employee" | "contractor";
  timer?: AppShellTimer | null;
  onStopTimer?: () => Promise<{ status: "success"; message: string }>;
  onUserAction?: (actionId: string) => void;
} = {}) {
  const messages = locale === "hu" ? hu : en;

  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <AppShell
          current={current}
          role="admin"
          profile={profile}
          timer={timer}
          onStopTimer={onStopTimer}
          onUserAction={onUserAction}
        >
          <p>content</p>
        </AppShell>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

const runningTimer: AppShellTimer = {
  description: "Refactor the invoice export",
  projectName: "Acme Portal",
  projectColor: "#4dd6c1",
  startedAt: new Date().toISOString(),
};

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
  it("keeps notifications available in the mobile header", () => {
    renderShell();

    const notificationTrigger = screen.getByRole("button", { name: "Notifications" });

    expect(notificationTrigger.closest(".hidden")).toBeNull();
  });

  it("keeps account actions available from the mobile header", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "User menu" }));

    expect(await screen.findByText("My rates")).toBeInTheDocument();
    expect(screen.getByText("Profile and settings")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("separates sign out from the navigational actions with a divider", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "User menu" }));

    const signOut = await screen.findByRole("menuitem", { name: "Sign out" });
    const settings = screen.getByRole("menuitem", { name: "Profile and settings" });

    expect(settings.nextElementSibling).toHaveAttribute("role", "separator");
    expect(settings.nextElementSibling).toBe(signOut.previousElementSibling);
  });

  it("asks before signing out instead of firing on the first click", async () => {
    const user = userEvent.setup();
    const onUserAction = vi.fn();
    renderShell({ onUserAction });

    await user.click(screen.getByRole("button", { name: "User menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("Sign out?")).toBeInTheDocument();
    expect(onUserAction).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Sign out" }));

    expect(onUserAction).toHaveBeenCalledWith("sign-out");
  });

  it("keeps the session when the confirmation is dismissed", async () => {
    const user = userEvent.setup();
    const onUserAction = vi.fn();
    renderShell({ onUserAction });

    await user.click(screen.getByRole("button", { name: "User menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Stay signed in" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onUserAction).not.toHaveBeenCalled();
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

describe("AppShell running timer", () => {
  it("renders no pill when nothing supplies a timer", () => {
    // The shell is rendered bare here on purpose: without a RunningTimerProvider above it,
    // `useRunningTimer` has to fall back rather than throw, or every story breaks too.
    renderShell();

    expect(screen.queryByRole("button", { name: "Stop timer" })).not.toBeInTheDocument();
  });

  it("keeps the running timer reachable in the mobile header", () => {
    renderShell({ timer: runningTimer });

    const pill = screen.getByRole("button", { name: "Open time tracking" });

    expect(pill).toBeInTheDocument();
    // The desktop-only control cluster is `hidden md:flex`; a running timer must not be inside it.
    expect(pill.closest(".hidden")).toBeNull();
  });

  it("stops the timer through the supplied handler", async () => {
    const user = userEvent.setup();
    const onStopTimer = vi.fn().mockResolvedValue({ status: "success" as const, message: "" });
    renderShell({ timer: runningTimer, onStopTimer });

    await user.click(screen.getByRole("button", { name: "Stop timer" }));

    expect(onStopTimer).toHaveBeenCalledTimes(1);
  });

  it("disables stopping when nothing can act on it", () => {
    renderShell({ timer: runningTimer });

    expect(screen.getByRole("button", { name: "Stop timer" })).toBeDisabled();
  });
});
