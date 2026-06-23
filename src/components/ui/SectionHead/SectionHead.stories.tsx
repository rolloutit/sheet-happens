import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "../Button";
import { SectionHead } from ".";

const meta = {
  title: "UI/SectionHead",
  component: SectionHead,
  args: {
    eyebrow: "Admin",
    title: "Review queue",
    subtitle: "Submitted timesheets and invoice deltas waiting for decision.",
    actions: <Button variant="cta">Export</Button>,
  },
} satisfies Meta<typeof SectionHead>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
