import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { StrengthMeter, evaluatePasswordStrength } from ".";

const strongPassword = evaluatePasswordStrength("CorrectHorse7!");

const meta = {
  title: "UI/StrengthMeter",
  component: StrengthMeter,
  args: {
    score: strongPassword.score,
    requirements: strongPassword.requirements,
  },
} satisfies Meta<typeof StrengthMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Strong: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: /password strength/i })).toHaveAttribute(
      "aria-valuenow",
      "4",
    );
  },
};

export const Weak: Story = {
  args: {
    ...evaluatePasswordStrength("short"),
    helperText: "Use a longer password with numbers and symbols.",
  },
};

export const CustomLabels: Story = {
  args: {
    score: 3,
    labels: {
      3: "Acceptable",
    },
  },
};
