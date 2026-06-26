import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";

import { ReportExportDialog } from ".";

const meta = {
  title: "Sheet/ReportExportDialog",
  component: ReportExportDialog,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    documentTitle: "June 2026",
    documentRows: [
      { id: "apollo", label: "Apollo Migration", value: "112h" },
      { id: "internal-cost", label: "Internal cost", value: "EUR 7,280", internalOnly: true },
    ],
    mode: "cost-free",
    onExport: fn(),
  },
} satisfies Meta<typeof ReportExportDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /export/i }));
    const dialog = await screen.findByRole("dialog");
    await expect(within(dialog).getByText(/june 2026/i)).toBeVisible();

    await userEvent.click(within(dialog).getByRole("button", { name: /export csv/i }));
    await expect(args.onExport).toHaveBeenCalledWith("csv");
  },
};

export const InternalPdfOnly: Story = {
  args: {
    mode: "internal",
    formats: ["pdf"],
  },
};
