import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";

import { ResultBanner } from ".";

const meta = {
  title: "UI/ResultBanner",
  component: ResultBanner,
  args: {
    tone: "success",
    children: "Group created.",
  },
} satisfies Meta<typeof ResultBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};

export const ErrorTone: Story = {
  args: { tone: "error", children: "That slug is already in use." },
};

export const Warning: Story = {
  args: { tone: "warning", children: "This group has no projects yet." },
};

export const Info: Story = {
  args: { tone: "info", children: "Archived groups stay out of filters." },
};

export const Dismissible: Story = {
  render: function DismissibleStory() {
    const [visible, setVisible] = useState(true);

    if (!visible) {
      return (
        <button
          type="button"
          className="text-sm text-accent underline"
          onClick={() => setVisible(true)}
        >
          Show banner again
        </button>
      );
    }

    return (
      <ResultBanner tone="success" onDismiss={() => setVisible(false)} dismissLabel="Dismiss">
        Project added to Client Delivery.
      </ResultBanner>
    );
  },
};

export const DismissCallback: Story = {
  args: {
    tone: "success",
    children: "Project added to Client Delivery.",
    dismissLabel: "Dismiss",
    onDismiss: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /dismiss/i }));
    await expect(args.onDismiss).toHaveBeenCalled();
  },
};

export const AllTones: Story = {
  render: () => (
    <div className="grid gap-2">
      <ResultBanner tone="success">Group created.</ResultBanner>
      <ResultBanner tone="error">That slug is already in use.</ResultBanner>
      <ResultBanner tone="warning">This group has no projects yet.</ResultBanner>
      <ResultBanner tone="info">Archived groups stay out of filters.</ResultBanner>
    </div>
  ),
};
