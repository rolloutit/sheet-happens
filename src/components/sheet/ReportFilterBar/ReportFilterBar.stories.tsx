import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen } from "storybook/test";

import { ReportFilterBar } from ".";

const periodOptions = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "custom", label: "Custom" },
];

const projectOptions = [
  { value: "all", label: "All projects" },
  { value: "apollo", label: "Apollo" },
  { value: "helix", label: "Helix" },
];

const meta = {
  title: "Sheet/ReportFilterBar",
  component: ReportFilterBar,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    periodValue: "month",
    projectValue: "all",
    view: "user",
    periodOptions,
    projectOptions,
  },
} satisfies Meta<typeof ReportFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ProjectView: Story = {
  args: {
    view: "project",
    projectValue: "apollo",
  },
};

export const Interactive: Story = {
  args: {
    onProjectChange: fn(),
    onViewChange: fn(),
    onExport: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /project/i }));
    await userEvent.click(screen.getByRole("option", { name: /apollo/i }));
    await expect(args.onProjectChange).toHaveBeenCalledWith("apollo");

    await userEvent.click(canvas.getByRole("radio", { name: /project/i }));
    await expect(args.onViewChange).toHaveBeenCalledWith("project");

    await userEvent.click(canvas.getByRole("button", { name: /export/i }));
    await expect(args.onExport).toHaveBeenCalled();
  },
};
