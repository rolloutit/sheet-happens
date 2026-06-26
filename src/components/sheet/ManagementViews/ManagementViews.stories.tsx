import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

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

export const DataDrivenPeople: Story = {
  args: {
    view: "people",
    onInvite: fn(),
    onPersonEdit: fn(),
    onPersonDelete: fn(),
    onViewChange: fn(),
    people: [
      {
        id: "1",
        name: "Lena Kovacs",
        email: "lena@example.com",
        profile: "Contractor",
        state: "active",
        currency: "EUR",
      },
      {
        id: "2",
        name: "Mark Chen",
        email: "mark@example.com",
        profile: "Employee",
        state: "inactive",
        currency: "HUF",
      },
    ],
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /invite/i }));
    await expect(args.onInvite).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: /edit lena kovacs/i }));
    await expect(args.onPersonEdit).toHaveBeenCalledWith(args.people?.[0]);

    await userEvent.click(canvas.getByRole("radio", { name: /projects/i }));
    await expect(args.onViewChange).toHaveBeenCalledWith("projects");
  },
};
