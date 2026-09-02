import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, screen } from "storybook/test";

import { Button } from "../Button";
import { DateRangePicker } from ".";
import type { DateRangeValue } from "./DateRangePicker.types";

const meta = {
  title: "UI/DateRangePicker",
  component: DateRangePicker,
  tags: ["autodocs"],
  args: {
    label: "Period",
    locale: "en",
  },
} satisfies Meta<typeof DateRangePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledRange({
  locale = "en",
  initial = { from: "2026-06-10", to: "2026-06-18" },
}: {
  locale?: string;
  initial?: DateRangeValue;
}) {
  const [value, setValue] = useState<DateRangeValue>(initial);

  return (
    <div className="grid w-80 gap-3">
      <DateRangePicker
        label="Period"
        locale={locale}
        value={value}
        onValueChange={setValue}
        placeholder="Pick a period"
      />
      <p className="font-ui text-sm text-muted-foreground">
        Value: <output data-testid="value">{`${value.from ?? "-"} to ${value.to ?? "-"}`}</output>
      </p>
    </div>
  );
}

export const Default: Story = {
  render: () => <ControlledRange />,
};

export const Hungarian: Story = {
  globals: { locale: "hu" },
  render: () => <ControlledRange locale="hu" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /period/i })).toHaveTextContent(
      "2026. jún. 10. - 2026. jún. 18.",
    );
  },
};

export const Empty: Story = {
  render: () => <ControlledRange initial={{}} />,
};

/** Only a start chosen: the trigger says so rather than rendering half a range. */
export const PartialRange: Story = {
  render: () => <ControlledRange initial={{ from: "2026-06-10" }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /period/i })).toHaveTextContent(
      "Jun 10, 2026 - End date",
    );
  },
};

/**
 * Starts from a half-open range so the calendar opens on a known month — with no value at
 * all it opens on today, which is the right default for a filter but not a fixed target
 * for a test.
 */
export const PicksARange: Story = {
  render: () => <ControlledRange initial={{ from: "2026-06-22" }} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /period/i }));

    await userEvent.click(screen.getByRole("button", { name: /Friday, June 26, 2026/i }));
    await expect(canvas.getByTestId("value")).toHaveTextContent("2026-06-22 to 2026-06-26");

    // The panel stays open so both ends can be picked in one gesture.
    await expect(screen.getByRole("button", { name: /^done$/i })).toBeVisible();
  },
};

/** Two hidden inputs, so existing validFrom/validTo pairs submit without schema changes. */
export const SubmitsTwoFields: Story = {
  render: () => {
    const [submitted, setSubmitted] = useState<string>();

    return (
      <form
        className="grid w-80 gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setSubmitted(`${data.get("validFrom")}|${data.get("validTo")}`);
        }}
      >
        <DateRangePicker
          label="Rate period"
          locale="en"
          names={{ from: "validFrom", to: "validTo" }}
          defaultValue={{ from: "2026-06-10", to: "2026-06-18" }}
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

    await expect(canvas.getByTestId("submitted")).toHaveTextContent("2026-06-10|2026-06-18");
  },
};

/** An open end submits as an empty string, which the "" -tolerant Zod refiners accept. */
export const OpenEndedSubmitsEmpty: Story = {
  render: () => {
    const [submitted, setSubmitted] = useState<string>();

    return (
      <form
        className="grid w-80 gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setSubmitted(`from=${data.get("validFrom")} to=${data.get("validTo")}`);
        }}
      >
        <DateRangePicker
          label="Rate period"
          locale="en"
          names={{ from: "validFrom", to: "validTo" }}
          defaultValue={{ from: "2026-06-10" }}
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

    await expect(canvas.getByTestId("submitted")).toHaveTextContent("from=2026-06-10 to=");
  },
};
