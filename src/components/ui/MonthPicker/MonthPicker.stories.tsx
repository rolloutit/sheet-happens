import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, screen } from "storybook/test";

import { Button } from "../Button";
import { MonthPicker } from ".";

const meta = {
  title: "UI/MonthPicker",
  component: MonthPicker,
  tags: ["autodocs"],
  args: {
    label: "Month",
    locale: "en",
  },
} satisfies Meta<typeof MonthPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledMonth({
  locale = "en",
  initial = "2026-06",
  ...rest
}: {
  locale?: string;
  initial?: string;
  min?: string;
  max?: string;
}) {
  const [value, setValue] = useState<string | undefined>(initial);

  return (
    <div className="grid w-72 gap-3">
      <MonthPicker
        label="Month"
        locale={locale}
        value={value}
        onValueChange={setValue}
        placeholder="All months"
        {...rest}
      />
      <p className="font-ui text-sm text-muted-foreground">
        Value: <output data-testid="value">{value ?? "none"}</output>
      </p>
    </div>
  );
}

export const Default: Story = {
  render: () => <ControlledMonth />,
};

export const Hungarian: Story = {
  globals: { locale: "hu" },
  render: () => <ControlledMonth locale="hu" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /month/i })).toHaveTextContent("2026. június");
  },
};

export const Empty: Story = {
  render: () => <ControlledMonth initial="" />,
};

/**
 * The single most load-bearing assertion in this component.
 *
 * `normalizeMonthInput` in `src/server/timesheets/admin-review.ts` matches `/^\d{4}-\d{2}$/`
 * and turns anything else into an empty string. A `YYYY-MM-01` value would drop the
 * timesheet month filter silently — no error, no signal, just every month at once.
 */
export const EmitsYearMonthOnly: Story = {
  render: () => <ControlledMonth />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /month/i }));
    await userEvent.click(screen.getByRole("gridcell", { name: /^sep$/i }));

    await expect(canvas.getByTestId("value")).toHaveTextContent("2026-09");
    await expect(canvas.getByTestId("value")).not.toHaveTextContent("2026-09-01");
  },
};

export const ChangesYear: Story = {
  render: () => <ControlledMonth />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /month/i }));
    await userEvent.click(screen.getByRole("button", { name: /previous year/i }));
    await userEvent.click(screen.getByRole("gridcell", { name: /^mar$/i }));

    await expect(canvas.getByTestId("value")).toHaveTextContent("2025-03");
  },
};

export const WithBounds: Story = {
  render: () => <ControlledMonth min="2026-03" max="2026-09" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /month/i }));

    await expect(screen.getByRole("gridcell", { name: /^may$/i })).toBeEnabled();
    await expect(screen.getByRole("gridcell", { name: /^jan$/i })).toBeDisabled();
    await expect(screen.getByRole("gridcell", { name: /^nov$/i })).toBeDisabled();
  },
};

export const SubmitsInAForm: Story = {
  render: () => {
    const [submitted, setSubmitted] = useState<string>();

    return (
      <form
        className="grid w-72 gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(String(new FormData(event.currentTarget).get("month")));
        }}
      >
        <MonthPicker
          label="Month"
          locale="en"
          name="month"
          defaultValue="2026-06"
          placeholder="All months"
        />
        <Button type="submit" size="sm">
          Submit
        </Button>
        <p className="font-ui text-sm text-muted-foreground">
          Submitted: <output data-testid="submitted">{submitted ?? "nothing"}</output>
        </p>
      </form>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /submit/i }));

    await expect(canvas.getByTestId("submitted")).toHaveTextContent("2026-06");
  },
};
