import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Clock3, FileCheck2 } from "lucide-react";
import { expect, screen, waitFor } from "storybook/test";

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

export const MobileNavigation: Story = {
  args: {
    children: null,
  },
  render: () => (
    <AppShell current="time" mobileNavigationMode="always">
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
    await expect(screen.getByRole("dialog")).toBeVisible();
    await expect(screen.getByRole("navigation", { name: /mobile navigation/i })).toBeVisible();
    await userEvent.click(screen.getByRole("link", { name: /timesheet/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  },
};
