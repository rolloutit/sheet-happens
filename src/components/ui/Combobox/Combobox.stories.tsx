import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { Combobox } from ".";

const options = [
  { value: "apollo", label: "Apollo Migration", meta: "Client project" },
  { value: "helix", label: "Helix Support", meta: "Managed service" },
  { value: "internal", label: "Internal Operations", meta: "Overhead" },
];

const meta = {
  title: "UI/Combobox",
  component: Combobox,
  args: {
    label: "Project",
    options,
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectPicker: Story = {
  render: () => {
    const [value, setValue] = useState("apollo");

    return (
      <div className="w-80">
        <Combobox
          label="Project"
          value={value}
          onValueChange={setValue}
          options={options}
          placeholder="Select project"
        />
      </div>
    );
  },
};
