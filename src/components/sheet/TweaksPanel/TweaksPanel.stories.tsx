import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TweaksPanel } from ".";

const meta = {
  title: "Sheet/TweaksPanel",
  component: TweaksPanel,
  globals: {
    theme: "light",
    locale: "hu",
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TweaksPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = {
  args: {
    open: false,
  },
};
