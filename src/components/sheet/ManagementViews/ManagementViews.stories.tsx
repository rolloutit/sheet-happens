import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ManagementViews } from ".";

const meta = {
  title: "Sheet/ManagementViews",
  component: ManagementViews,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    view: "people",
  },
} satisfies Meta<typeof ManagementViews>;

export default meta;
type Story = StoryObj<typeof meta>;

export const People: Story = {};

export const Projects: Story = {
  args: {
    view: "projects",
  },
};

export const Rates: Story = {
  args: {
    view: "rates",
  },
};
