import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Clock3, FileCheck2 } from "lucide-react";
import { expect, fn, mocked, screen, waitFor, within } from "storybook/test";

import { setLocaleAction } from "@/src/i18n/actions";
import { EmptyState } from "@/src/components/sheet/EmptyState";
import { StatusPill } from "@/src/components/sheet/StatusPill";
import { Button } from "@/src/components/ui/Button";
import { AppShell } from ".";

const meta = {
  title: "Layout/AppShell",
  component: AppShell,
  tags: ["autodocs"],
  globals: {
    theme: "dark",
    locale: "hu",
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FoundationPage: Story = {
  args: {
    children: null,
  },
  render: () => (
    <AppShell>
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6">
        <section className="rounded-[var(--radius-xl)] border border-border bg-card/80 p-6 shadow-soft">
          <div className="flex flex-wrap gap-2">
            <StatusPill status="submitted" />
            <StatusPill status="approved" />
            <StatusPill status="paid" />
          </div>
          <h1 className="mt-4 text-3xl font-bold">Alkalmazás váz</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            A layout story láthatóvá teszi a navigációt, a fejléc ritmusát és a sötét felületeket a
            komponenskönyvtárban.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button icon={Clock3}>Idő rögzítése</Button>
            <Button variant="cta">Hónap beküldése</Button>
          </div>
        </section>
        <EmptyState
          icon={FileCheck2}
          title="Nincs függő jóváhagyás"
          body="A layout kényelmes üres állapot térközt tart az alkalmazás keretén belül."
        />
      </div>
    </AppShell>
  ),
};

/**
 * `setLocaleAction` is a `"use server"` module, replaced in Storybook by `src/i18n/__mocks__` (see
 * `.storybook/preview.tsx`). That mock is an `fn()` spy, so the language toggle's real side effect
 * is finally assertable here.
 */
export const LanguageSwitch: Story = {
  args: {
    children: null,
  },
  render: () => (
    <AppShell>
      <div className="px-4 py-6" />
    </AppShell>
  ),
  play: async ({ canvas, userEvent }) => {
    mocked(setLocaleAction).mockClear();

    await userEvent.click(canvas.getByRole("radio", { name: "EN" }));

    await waitFor(() => expect(setLocaleAction).toHaveBeenCalledWith("en"));
  },
};

export const MobileNavigation: Story = {
  args: {
    children: null,
  },
  render: () => (
    // `onNavigate` is required here, not decorative: without it `handleNavigate` falls through to
    // `window.location.href`, which navigates the test iframe out from under the runner.
    <AppShell current="time" profile="contractor" mobileNavigationMode="always" onNavigate={fn()}>
      <div className="grid gap-4 px-4 py-6">
        <h1 className="text-2xl font-semibold">Mobil váz</h1>
        <p className="text-sm text-muted-foreground">
          A mobil navigáció drawerből nyílik, és menüpont választáskor bezár.
        </p>
      </div>
    </AppShell>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /navigáció megnyitása/i }));

    const drawer = await screen.findByRole("dialog");
    await expect(drawer).toBeVisible();

    // Scoped to the drawer: `mobileNavigationMode="always"` also renders the bottom bar, and both
    // landmarks carry the same "Mobil navigáció" label under this story's `hu` locale.
    await expect(
      within(drawer).getByRole("navigation", { name: /mobil navigáció/i }),
    ).toBeVisible();
    await userEvent.click(within(drawer).getByRole("link", { name: /timesheet/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  },
};
