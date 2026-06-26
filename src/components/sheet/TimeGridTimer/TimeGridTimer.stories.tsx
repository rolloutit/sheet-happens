import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen } from "storybook/test";

import { TimeGridTimer } from ".";

const projectOptions = [
  { value: "apollo", label: "Apollo Migration" },
  { value: "helix", label: "Helix Support" },
];

const meta = {
  title: "Sheet/TimeGridTimer",
  component: TimeGridTimer,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    projectOptions,
    projectValue: "apollo",
    descriptionValue: "Invoice diff review",
    elapsedLabel: "01:24:12",
    running: false,
  },
} satisfies Meta<typeof TimeGridTimer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Running: Story = {
  args: {
    running: true,
  },
};

export const Interactive: Story = {
  args: {
    descriptionValue: undefined,
    onProjectChange: fn(),
    onDescriptionChange: fn(),
    onStart: fn(),
    onReset: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /project/i }));
    await userEvent.click(screen.getByRole("option", { name: /helix support/i }));
    await expect(args.onProjectChange).toHaveBeenCalledWith("helix");

    await userEvent.clear(canvas.getByLabelText(/timer description/i));
    await userEvent.type(canvas.getByLabelText(/timer description/i), "Review invoices");
    await expect(args.onDescriptionChange).toHaveBeenLastCalledWith("Review invoices");

    await userEvent.click(canvas.getByRole("button", { name: /^start$/i }));
    await expect(args.onStart).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: /reset timer/i }));
    await expect(args.onReset).toHaveBeenCalled();
  },
};
