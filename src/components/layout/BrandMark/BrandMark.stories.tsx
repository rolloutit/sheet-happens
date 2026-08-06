import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { BrandMark } from ".";

const meta = {
  title: "Layout/BrandMark",
  component: BrandMark,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex items-center gap-3 bg-sidebar p-6">
        <Story />
        <div className="leading-tight">
          <p className="text-base font-semibold">Sheet Happens</p>
          <p className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Rollout IT · Internal
          </p>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof BrandMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The cream mark, on the dark sidebar surface. */
export const Dark: Story = {
  globals: {
    theme: "dark",
  },
  play: async ({ canvas }) => {
    // Both files are always in the markup, but only the painted one is exposed to the tree.
    const marks = canvas.getAllByRole("img", { name: "Rollout IT" });

    await expect(marks).toHaveLength(1);
    await expect(marks[0]).toHaveAttribute(
      "src",
      expect.stringContaining("rolloutit-mark-light.png"),
    );
  },
};

/** The deep-teal mark, on the white sidebar surface. */
export const Light: Story = {
  globals: {
    theme: "light",
  },
  play: async ({ canvas }) => {
    const marks = canvas.getAllByRole("img", { name: "Rollout IT" });

    await expect(marks).toHaveLength(1);
    await expect(marks[0]).toHaveAttribute(
      "src",
      expect.stringContaining("rolloutit-mark-blue.png"),
    );
  },
};

/**
 * The auth panel's teal gradient stays dark in both themes, so `onDark` pins the cream ink there —
 * `auto` would paint the deep-teal mark onto near-black teal in the light theme.
 */
export const OnDark: Story = {
  args: {
    size: 24,
    tone: "onDark",
  },
  globals: {
    theme: "light",
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-3 bg-[radial-gradient(120%_90%_at_18%_8%,#2c7c7c_0%,#0c423f_55%,#08302d_100%)] p-6">
        <span className="grid size-10 place-items-center rounded-[var(--radius-md)] border border-white/20 bg-white/12">
          <Story />
        </span>
        <p className="font-ui text-[17px] font-semibold text-[#eafbfa]">Sheet Happens</p>
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    // Light theme, yet the cream mark is what paints — and it is the only one in the markup.
    const marks = canvas.getAllByRole("img", { name: "Rollout IT" });

    await expect(marks).toHaveLength(1);
    await expect(marks[0]).toHaveAttribute(
      "src",
      expect.stringContaining("rolloutit-mark-light.png"),
    );
  },
};

/** The collapsed sidebar and the mobile drawer trigger show the mark without a wordmark. */
export const Standalone: Story = {
  args: {
    size: 32,
  },
  decorators: [
    (Story) => (
      <div className="grid w-[76px] place-items-center bg-sidebar py-4">
        <Story />
      </div>
    ),
  ],
};
