import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, waitFor } from "storybook/test";

import { Field } from "../Field";
import { defaultSearchThreshold, Select } from ".";

const statuses = [
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
];

/** `defaultSearchThreshold` options exactly — the last count that stays a plain menu. */
const atThreshold = Array.from({ length: defaultSearchThreshold }, (_, index) => ({
  value: `option-${index}`,
  label: `Option ${index + 1}`,
}));

/** One more than the threshold — the first count that grows a search field. */
const overThreshold = [
  ...atThreshold,
  { value: "one-more", label: `Option ${defaultSearchThreshold + 1}` },
];

const meta = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
  args: {
    label: "Status",
    placeholder: "Choose status",
    options: statuses,
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InField: Story = {
  render: (args) => (
    <Field id="status" label="Status" hint="Plain menu, because the list is short.">
      {({ id, describedBy }) => <Select {...args} id={id} aria-describedby={describedBy} />}
    </Field>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /status/i }));
    await userEvent.click(screen.getByRole("option", { name: /approved/i }));

    await expect(canvas.getByRole("combobox", { name: /status/i })).toHaveTextContent(/approved/i);
  },
};

export const DisabledOption: Story = {
  args: {
    defaultValue: "submitted",
    options: [
      { value: "submitted", label: "Submitted" },
      { value: "approved", label: "Approved", disabled: true },
      { value: "paid", label: "Paid" },
    ],
  },
};

export const WithSecondaryText: Story = {
  args: {
    label: "Contractor",
    placeholder: "Choose contractor",
    options: [
      { value: "ben", label: "Szabó Réka", meta: "reka.szabo@example.com" },
      { value: "ada", label: "Ada Lovelace", meta: "ada@example.com" },
    ],
  },
};

/**
 * The one behaviour every "All …" filter depends on: Radix treats an empty value as
 * "unset" and renders the placeholder, so the empty option's label has to be repeated as
 * the placeholder or the trigger comes up blank.
 */
export const AllOption: Story = {
  args: {
    label: "Project",
    placeholder: "All projects",
    defaultValue: "",
    options: [
      { value: "", label: "All projects" },
      { value: "apollo", label: "Apollo Migration" },
      { value: "helix", label: "Helix Support" },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: /project/i })).toHaveTextContent(
      /all projects/i,
    );
  },
};

/**
 * Locks the switch in place. Both controls must look identical and expose the same trigger
 * role; only the panel differs. If this ever renders two visibly different fields, the
 * shared trigger surface has drifted.
 */
export const ThresholdBoundary: Story = {
  render: (args) => (
    <div className="grid gap-4">
      <Field label={`${defaultSearchThreshold} options`} hint="Plain menu.">
        {({ id }) => <Select {...args} id={id} label="At threshold" options={atThreshold} />}
      </Field>
      <Field label={`${defaultSearchThreshold + 1} options`} hint="Grows a search field.">
        {({ id }) => <Select {...args} id={id} label="Over threshold" options={overThreshold} />}
      </Field>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /at threshold/i }));
    await expect(screen.queryByRole("combobox", { name: /search/i })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(canvas.getByRole("combobox", { name: /over threshold/i }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /search/i })).toBeInTheDocument(),
    );
  },
};

export const ForcedSearchable: Story = {
  args: {
    label: "Status",
    searchable: true,
    options: statuses,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /status/i }));

    const search = screen.getByRole("combobox", { name: /search/i });
    await userEvent.type(search, "paid");
    await userEvent.click(screen.getByRole("option", { name: /paid/i }));

    await expect(canvas.getByRole("combobox", { name: /status/i })).toHaveTextContent(/paid/i);
  },
};

export const ForcedPlainMenu: Story = {
  args: {
    label: "Option",
    searchable: false,
    options: overThreshold,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /option/i }));

    await expect(screen.queryByRole("combobox", { name: /search/i })).not.toBeInTheDocument();
  },
};
