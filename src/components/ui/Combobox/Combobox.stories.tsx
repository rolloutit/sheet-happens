import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, screen } from "storybook/test";

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
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /project/i }));
    await userEvent.type(screen.getByRole("searchbox", { name: /search/i }), "helix");
    await expect(screen.getByRole("option", { name: /helix support/i })).toBeVisible();
    await userEvent.click(screen.getByRole("option", { name: /helix support/i }));
    await expect(canvas.getByRole("combobox", { name: /project/i })).toHaveTextContent(/helix/i);
  },
};

export const EmptyResults: Story = {
  render: () => (
    <div className="w-80">
      <Combobox label="Project" options={options} emptyLabel="No projects found" />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /project/i }));
    await userEvent.type(screen.getByRole("searchbox", { name: /search/i }), "missing");
    await expect(screen.getByText(/no projects found/i)).toBeVisible();
  },
};

export const DisabledOption: Story = {
  args: {
    onValueChange: fn(),
  },
  render: () => (
    <div className="w-80">
      <Combobox
        label="Project"
        options={[
          options[0],
          { value: "locked", label: "Locked Project", disabled: true },
          options[1],
        ]}
      />
    </div>
  ),
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /project/i }));
    const search = screen.getByRole("searchbox", { name: /search/i });

    await userEvent.type(search, "locked");
    await expect(screen.getByRole("option", { name: /locked project/i })).toBeDisabled();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const KeyboardSelection: Story = {
  args: {
    onValueChange: fn(),
  },
  render: (args) => (
    <div className="w-80">
      <Combobox
        label="Project"
        value="apollo"
        onValueChange={args.onValueChange}
        options={options}
        placeholder="Select project"
      />
    </div>
  ),
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /project/i }));
    const search = screen.getByRole("searchbox", { name: /search/i });
    await expect(search).toHaveFocus();

    const selectedOption = screen.getByRole("option", { name: /apollo migration/i });
    await expect(search.getAttribute("aria-activedescendant")).toBe(selectedOption.id);

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await expect(args.onValueChange).toHaveBeenCalledWith("internal");
    await expect(canvas.getByRole("combobox", { name: /project/i })).toHaveFocus();
  },
};
