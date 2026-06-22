import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Clock3, FileCheck2 } from "lucide-react";

import { EmptyState } from "@/src/components/sheet/EmptyState";
import { StatusPill } from "@/src/components/sheet/StatusPill";
import { Button } from "@/src/components/ui/Button";
import { AppShell } from ".";

const meta = {
  title: "Layout/AppShell",
  component: AppShell,
  tags: ["autodocs"],
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
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6">
        <section className="rounded-[var(--radius-xl)] border border-border bg-card/80 p-6 shadow-soft">
          <div className="flex flex-wrap gap-2">
            <StatusPill status="submitted" />
            <StatusPill status="approved" />
            <StatusPill status="paid" />
          </div>
          <h1 className="mt-4 text-3xl font-bold">App shell frame</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            The layout story keeps navigation, header spacing, dark theme surfaces, and page
            composition visible in the component library.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button icon={Clock3}>Log time</Button>
            <Button variant="cta">Submit month</Button>
          </div>
        </section>
        <EmptyState
          icon={FileCheck2}
          title="No pending review"
          body="The layout should preserve comfortable empty-state spacing inside the app frame."
        />
      </main>
    </AppShell>
  ),
};
