"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/src/components/ui/Button";
import { notify, SheetToaster } from ".";

const meta = {
  title: "Sheet/Toast",
  component: SheetToaster,
  tags: ["autodocs"],
} satisfies Meta<typeof SheetToaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToastKinds: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <SheetToaster />
      <Button onClick={() => notify("success", "Timesheet submitted.")}>Success</Button>
      <Button variant="soft" onClick={() => notify("info", "Reminder queued.")}>
        Info
      </Button>
      <Button variant="cta" onClick={() => notify("warning", "This week has missing entries.")}>
        Warning
      </Button>
      <Button variant="danger" onClick={() => notify("error", "Invoice rejected.")}>
        Error
      </Button>
    </div>
  ),
};
