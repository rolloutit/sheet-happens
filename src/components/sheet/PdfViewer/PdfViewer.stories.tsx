import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { PdfViewer } from ".";

const meta = {
  title: "Sheet/PdfViewer",
  component: PdfViewer,
  tags: ["autodocs"],
  args: {
    title: "Invoice INV-2026-06",
    src: "about:blank",
    page: 1,
    totalPages: 4,
    onNextPage: fn(),
    onDownload: fn(),
  },
} satisfies Meta<typeof PdfViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /next/i }));
    await expect(args.onNextPage).toHaveBeenCalled();
    await expect(canvas.getByLabelText(/invoice inv-2026-06 pdf preview/i)).toBeVisible();
  },
};

export const Loading: Story = {
  args: {
    state: "loading",
    src: undefined,
  },
};

export const Error: Story = {
  args: {
    state: "error",
    src: undefined,
  },
};
