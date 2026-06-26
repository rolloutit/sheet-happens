import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { WeeklyTimeGrid } from ".";
import type { TimeGridDay, TimeGridProject } from ".";

const days = [
  { id: "mon", label: "Hétfő", date: "17" },
  { id: "tue", label: "Kedd", date: "18" },
  { id: "wed", label: "Szerda", date: "19" },
  { id: "thu", label: "Csütörtök", date: "20" },
  { id: "fri", label: "Péntek", date: "21", state: "today" },
  { id: "sat", label: "Szombat", date: "22", state: "future" },
  { id: "sun", label: "Vasárnap", date: "23", state: "future" },
] satisfies TimeGridDay[];

const projects = [
  {
    id: "apollo",
    name: "Apollo migráció",
    color: "#37e3de",
    hours: [8, 6, 7.5, 8, 4, 0, 0],
    cells: {
      wed: { hours: 7.5, warning: "Leírás hiányzik" },
    },
  },
  { id: "helix", name: "Helix support", color: "#ffc68b", hours: [1, 2, 0, 1.5, 0, 0, 0] },
  {
    id: "legacy",
    name: "Belső admin",
    color: "#72df9a",
    inactive: true,
    hours: [0, 0, 2, 0, 0, 0, 0],
  },
] satisfies TimeGridProject[];

const meta = {
  title: "Sheet/WeeklyTimeGrid",
  component: WeeklyTimeGrid,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    projects,
    days,
  },
} satisfies Meta<typeof WeeklyTimeGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  args: {
    onCellEditStart: fn(),
    onCellChange: fn(),
    onSave: fn(),
    onProjectSelect: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    const monday = canvas.getByRole("button", { name: /apollo migráció, hétfő/i });
    monday.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("button", { name: /apollo migráció, kedd/i })).toHaveFocus();

    await userEvent.click(canvas.getByRole("button", { name: /apollo migráció, hétfő/i }));
    await expect(args.onCellEditStart).toHaveBeenCalledWith(
      expect.objectContaining({
        project: expect.objectContaining({ id: "apollo" }),
        day: expect.objectContaining({ id: "mon" }),
      }),
    );

    const input = canvas.getByRole("spinbutton", { name: /edit apollo migráció, hétfő/i });
    await userEvent.clear(input);
    await userEvent.type(input, "9");
    await expect(args.onCellChange).toHaveBeenLastCalledWith(expect.any(Object), 9);

    await userEvent.click(canvas.getByRole("button", { name: /^mentés$/i }));
    await expect(args.onSave).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: /^helix support$/i }));
    await expect(args.onProjectSelect).toHaveBeenCalledWith(projects[1]);
  },
};

export const CellStates: Story = {
  args: {
    projects: [
      {
        id: "apollo",
        name: "Apollo migráció",
        color: "#37e3de",
        cells: {
          mon: { hours: 8, state: "filled" },
          tue: { hours: 0, state: "empty" },
          wed: { hours: 7.5, warning: "Leírás hiányzik" },
          thu: { hours: 4, locked: true },
          fri: { hours: 2, state: "today" },
          sat: { hours: 0, state: "future" },
        },
      },
    ],
  },
};

export const Locked: Story = {
  args: {
    locked: true,
  },
};

export const WithTimer: Story = {
  args: {
    showTimer: true,
    timer: {
      projectId: "apollo",
      description: "Invoice diff review",
      elapsedLabel: "01:24:12",
      running: true,
    },
  },
};

export const MobileDayGrid: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
