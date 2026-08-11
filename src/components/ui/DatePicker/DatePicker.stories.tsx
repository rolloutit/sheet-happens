import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, screen, waitFor } from "storybook/test";

import { Button } from "../Button";
import { Field } from "../Field";
import { DatePicker } from ".";

const meta = {
  title: "UI/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  args: {
    label: "Entry date",
    locale: "en",
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledPicker({
  locale = "en",
  initial = "2026-06-24",
  ...rest
}: {
  locale?: string;
  initial?: string;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState<string | undefined>(initial);

  return (
    <div className="grid w-72 gap-3">
      <DatePicker
        label="Entry date"
        locale={locale}
        value={value}
        onValueChange={setValue}
        placeholder="Pick a date"
        {...rest}
      />
      <p className="font-ui text-sm text-muted-foreground">
        Value: <output data-testid="value">{value ?? "none"}</output>
      </p>
    </div>
  );
}

export const Default: Story = {
  render: () => <ControlledPicker />,
};

/** The trigger label goes through `formatDateLabel`, so it matches the tables around it. */
export const Hungarian: Story = {
  globals: { locale: "hu" },
  render: () => <ControlledPicker locale="hu" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /entry date/i })).toHaveTextContent(
      "2026. jún. 24.",
    );
  },
};

export const Empty: Story = {
  render: () => <ControlledPicker initial="" />,
};

export const InField: Story = {
  render: () => (
    <Field label="Entry date" hint="Clamped to the current week." error={undefined}>
      {({ id, describedBy, invalid }) => (
        <DatePicker
          id={id}
          label="Entry date"
          locale="en"
          aria-describedby={describedBy}
          invalid={invalid}
          defaultValue="2026-06-24"
          min="2026-06-22"
          max="2026-06-28"
        />
      )}
    </Field>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Field label="Entry date" error="Choose a date inside the open week.">
      {({ id, describedBy, invalid }) => (
        <DatePicker
          id={id}
          label="Entry date"
          locale="en"
          aria-describedby={describedBy}
          invalid={invalid}
        />
      )}
    </Field>
  ),
};

export const PicksADate: Story = {
  render: () => <ControlledPicker />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /entry date/i }));
    await userEvent.click(screen.getByRole("button", { name: /Thursday, June 25, 2026/i }));

    await expect(canvas.getByTestId("value")).toHaveTextContent("2026-06-25");
    // Choosing a day closes the panel and hands focus back to the trigger.
    await waitFor(() => expect(canvas.getByRole("button", { name: /entry date/i })).toHaveFocus());
  },
};

export const ClearAndToday: Story = {
  render: () => <ControlledPicker />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /entry date/i }));
    await userEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    await expect(canvas.getByTestId("value")).toHaveTextContent("none");

    await userEvent.click(canvas.getByRole("button", { name: /entry date/i }));
    await userEvent.click(screen.getByRole("button", { name: /^today$/i }));
    await expect(canvas.getByTestId("value")).not.toHaveTextContent("none");
  },
};

/** A required date has nothing to clear to, so the button is withheld rather than shown. */
export const RequiredHidesClear: Story = {
  render: () => <ControlledPicker required />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /entry date/i }));

    await expect(screen.queryByRole("button", { name: /^clear$/i })).not.toBeInTheDocument();
    await expect(screen.getByRole("button", { name: /^today$/i })).toBeVisible();
  },
};

export const BoundsDisableDays: Story = {
  render: () => <ControlledPicker initial="2026-06-24" min="2026-06-22" max="2026-06-26" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /entry date/i }));

    await expect(screen.getByRole("button", { name: /Tuesday, June 23, 2026/i })).toBeEnabled();
    await expect(screen.getByRole("button", { name: /Sunday, June 28, 2026/i })).toBeDisabled();
  },
};

/** Uncontrolled use in a form: the hidden input carries the value and follows reset. */
export const SubmitsInAForm: Story = {
  render: () => {
    const [submitted, setSubmitted] = useState<string>();

    return (
      <form
        className="grid w-72 gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(String(new FormData(event.currentTarget).get("validFrom")));
        }}
      >
        <DatePicker
          label="Valid from"
          locale="en"
          name="validFrom"
          defaultValue="2026-06-24"
          placeholder="Pick a date"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Submit
          </Button>
          <Button type="reset" size="sm" variant="soft">
            Reset
          </Button>
        </div>
        <p className="font-ui text-sm text-muted-foreground">
          Submitted: <output data-testid="submitted">{submitted ?? "nothing"}</output>
        </p>
      </form>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /valid from/i }));
    await userEvent.click(screen.getByRole("button", { name: /Friday, June 26, 2026/i }));
    await userEvent.click(canvas.getByRole("button", { name: /submit/i }));
    await expect(canvas.getByTestId("submitted")).toHaveTextContent("2026-06-26");

    await userEvent.click(canvas.getByRole("button", { name: /reset/i }));
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: /valid from/i })).toHaveTextContent("Jun 24, 2026"),
    );
  },
};
