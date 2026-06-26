"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, waitFor } from "storybook/test";

import { Button } from "@/src/components/ui/Button";
import { notify, SheetToaster } from ".";

const meta = {
  title: "Sheet/Toast",
  component: SheetToaster,
  tags: ["autodocs"],
} satisfies Meta<typeof SheetToaster>;

export default meta;
type Story = StoryObj<typeof meta>;

const onReview = fn();
const onDismiss = fn();

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
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /success/i }));
    await expect(screen.getByText(/timesheet submitted/i)).toBeInTheDocument();
  },
};

export const WithAction: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <SheetToaster />
      <Button
        onClick={() =>
          notify("warning", "This week has missing entries.", {
            description: "Review Friday before submitting.",
            action: {
              label: "Review",
              onClick: onReview,
            },
            cancel: {
              label: "Dismiss",
              onClick: onDismiss,
            },
          })
        }
      >
        Show action toast
      </Button>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /show action toast/i }));
    await expect(screen.getByText(/missing entries/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /review/i }));
    await expect(onReview).toHaveBeenCalled();
    await expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  },
};

export const AutoDismiss: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <SheetToaster />
      <Button
        onClick={() =>
          notify("info", "Autosaved draft.", {
            duration: 150,
          })
        }
      >
        Show short toast
      </Button>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /show short toast/i }));
    await expect(screen.getByText(/autosaved draft/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/autosaved draft/i)).not.toBeInTheDocument(), {
      timeout: 3000,
    });
  },
};
