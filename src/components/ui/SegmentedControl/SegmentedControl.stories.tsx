import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { SegmentedControl } from ".";

const meta = {
  title: "UI/SegmentedControl",
  component: SegmentedControl,
  args: {
    label: "Period",
    value: "week",
    items: [
      { value: "day", label: "Day" },
      { value: "week", label: "Week" },
    ],
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("week");

    return (
      <SegmentedControl
        label="Period"
        value={value}
        onValueChange={setValue}
        items={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week", count: 5 },
          { value: "month", label: "Month" },
        ]}
      />
    );
  },
};
