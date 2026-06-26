import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, screen, waitFor } from "storybook/test";

import { Field } from "../Field";
import { DatePicker } from ".";

const meta = {
  title: "UI/DatePicker",
  component: DatePicker,
  args: {
    label: "Date",
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<Date | undefined>(new Date(2026, 5, 22));

    return (
      <div className="w-80">
        <Field id="start-date" label="Start date">
          {({ id, describedBy }) => (
            <DatePicker
              id={id}
              aria-describedby={describedBy}
              label="Start date"
              value={value}
              onValueChange={setValue}
            />
          )}
        </Field>
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /start date/i }));
    await expect(screen.getByRole("grid", { name: /start date/i })).toBeVisible();
    const selectedDate = screen.getByRole("gridcell", { name: /monday, june 22, 2026/i });
    await expect(selectedDate).toHaveAttribute("aria-selected", "true");
    selectedDate.focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("gridcell", { name: /tuesday, june 23, 2026/i })).toHaveFocus(),
    );
    await userEvent.keyboard("{Home}");
    await waitFor(() =>
      expect(screen.getByRole("gridcell", { name: /monday, june 22, 2026/i })).toHaveFocus(),
    );
    await userEvent.keyboard("{End}");
    await waitFor(() =>
      expect(screen.getByRole("gridcell", { name: /sunday, june 28, 2026/i })).toHaveFocus(),
    );
    await userEvent.keyboard("{PageDown}");
    await waitFor(() =>
      expect(screen.getByRole("gridcell", { name: /tuesday, july 28, 2026/i })).toHaveFocus(),
    );
    await userEvent.keyboard("{PageUp}");
    await waitFor(() =>
      expect(screen.getByRole("gridcell", { name: /sunday, june 28, 2026/i })).toHaveFocus(),
    );
  },
};

export const DisabledDates: Story = {
  render: () => {
    const [value, setValue] = useState<Date | undefined>(new Date(2026, 5, 26));

    return (
      <div className="w-80">
        <DatePicker
          label="Invoice date"
          value={value}
          onValueChange={setValue}
          disabledDate={(date) => date.getDay() === 0 || date.getDay() === 6}
        />
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /invoice date/i }));
    const friday = screen.getByRole("gridcell", { name: /friday, june 26, 2026/i });
    friday.focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("gridcell", { name: /monday, june 29, 2026/i })).toHaveFocus(),
    );
  },
};

export const HungarianLocale: Story = {
  render: () => {
    const [value, setValue] = useState<Date | undefined>(new Date(2026, 5, 22));

    return (
      <div className="w-80">
        <DatePicker label="Kezdés" locale="hu" value={value} onValueChange={setValue} />
      </div>
    );
  },
};
