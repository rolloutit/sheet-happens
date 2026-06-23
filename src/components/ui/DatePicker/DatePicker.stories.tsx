import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

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
        <Field label="Start date">
          <DatePicker label="Start date" value={value} onValueChange={setValue} />
        </Field>
      </div>
    );
  },
};
