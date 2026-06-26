import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { PayslipViewer } from ".";

const meta = {
  title: "Sheet/PayslipViewer",
  component: PayslipViewer,
  globals: {
    theme: "dark",
    locale: "hu",
  },
  args: {
    title: "Viewer",
    fileName: "payslip-june.pdf",
    state: "loading",
  },
} satisfies Meta<typeof PayslipViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};

export const Ready: Story = {
  args: {
    state: "ready",
    onOpen: fn(),
    onDownload: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open preview/i }));
    await expect(args.onOpen).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: /download/i }));
    await expect(args.onDownload).toHaveBeenCalled();
  },
};

export const Error: Story = {
  args: {
    state: "error",
  },
};

export const Empty: Story = {
  args: {
    state: "empty",
  },
};
