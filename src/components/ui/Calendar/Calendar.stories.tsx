import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect } from "storybook/test";

import { Calendar } from ".";
import type { CalendarRangeValue } from "./Calendar.types";

const meta = {
  title: "UI/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  args: {
    locale: "en",
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

const panel = "w-fit rounded-[var(--radius-lg)] border border-border-strong bg-popover p-3";

function SingleCalendar({
  locale = "en",
  value: initialValue = "2026-06-24",
  ...rest
}: {
  locale?: string;
  value?: string;
  min?: string;
  max?: string;
}) {
  const [value, setValue] = useState<string | undefined>(initialValue);

  return (
    <div className="grid gap-3">
      <div className={panel}>
        <Calendar locale={locale} value={value} onValueChange={setValue} {...rest} />
      </div>
      <p className="font-ui text-sm text-muted-foreground">
        Value: <output data-testid="value">{value ?? "none"}</output>
      </p>
    </div>
  );
}

export const Single: Story = {
  render: () => <SingleCalendar />,
};

/** Hungarian weekday abbreviations and a lowercase month name the caption capitalises. */
export const Hungarian: Story = {
  globals: { locale: "hu" },
  render: () => <SingleCalendar locale="hu" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Sze")).toBeVisible();
    await expect(canvas.getByText("Szo")).toBeVisible();
  },
};

/**
 * The reason the public API never exposes a `Date`.
 *
 * react-day-picker runs in `timeZone="UTC"` and hands back a `TZDate`; if that were read
 * with local-time accessors, a browser east or west of UTC would emit the neighbouring day.
 * The assertion is the exact string, not a rendered label.
 */
export const SelectionRoundTrip: Story = {
  render: () => <SingleCalendar />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByTestId("value")).toHaveTextContent("2026-06-24");

    await userEvent.click(canvas.getByRole("button", { name: /Thursday, June 25, 2026/i }));
    await expect(canvas.getByTestId("value")).toHaveTextContent("2026-06-25");

    // Crossing a month boundary is where an off-by-one would be most visible.
    await userEvent.click(canvas.getByRole("button", { name: /Tuesday, June 30, 2026/i }));
    await expect(canvas.getByTestId("value")).toHaveTextContent("2026-06-30");
  },
};

export const WithBounds: Story = {
  render: () => <SingleCalendar value="2026-06-15" min="2026-06-10" max="2026-06-20" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /Friday, June 12, 2026/i })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: /Monday, June 22, 2026/i })).toBeDisabled();
  },
};

export const Range: Story = {
  render: () => {
    const [value, setValue] = useState<CalendarRangeValue>({
      from: "2026-06-10",
      to: "2026-06-18",
    });

    return (
      <div className="grid gap-3">
        <div className={panel}>
          <Calendar
            mode="range"
            locale="en"
            numberOfMonths={2}
            value={value}
            onValueChange={setValue}
          />
        </div>
        <p className="font-ui text-sm text-muted-foreground">
          Value: <output data-testid="value">{`${value.from ?? "-"} to ${value.to ?? "-"}`}</output>
        </p>
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByTestId("value")).toHaveTextContent("2026-06-10 to 2026-06-18");

    // Clicking with a complete range starts over rather than stretching the old one.
    await userEvent.click(canvas.getByRole("button", { name: /Monday, June 22, 2026/i }));
    await expect(canvas.getByTestId("value")).toHaveTextContent("2026-06-22 to -");

    await userEvent.click(canvas.getByRole("button", { name: /Friday, June 26, 2026/i }));
    await expect(canvas.getByTestId("value")).toHaveTextContent("2026-06-22 to 2026-06-26");
  },
};
