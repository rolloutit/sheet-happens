import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect } from "storybook/test";

import { LanguageToggle } from ".";

const meta = {
  title: "Layout/LanguageToggle",
  component: LanguageToggle,
  tags: ["autodocs"],
  args: {
    value: "hu",
  },
} satisfies Meta<typeof LanguageToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("hu");

    return <LanguageToggle value={value} onValueChange={setValue} />;
  },
  play: async ({ canvas, userEvent }) => {
    const english = canvas.getByRole("radio", { name: "EN" });
    await userEvent.click(english);
    await expect(english).toHaveAttribute("aria-checked", "true");
  },
};

export const FullWidth: Story = {
  render: () => {
    const [value, setValue] = useState("en");

    return (
      <div className="w-72">
        <LanguageToggle value={value} width="full" onValueChange={setValue} />
      </div>
    );
  },
};
