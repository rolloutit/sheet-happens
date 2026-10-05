import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";

import { SuggestInput } from ".";
import type { SuggestOption } from "./SuggestInput.types";

const options: SuggestOption[] = [
  { text: "API endpoint implementation", meta: "18 times · last used Sep 3" },
  { text: "Sprint planning", meta: "9 times · last used Sep 1" },
  { text: "Code review", meta: "7 times · last used Sep 2" },
  { text: "Árajánlat egyeztetés", meta: "4 times · last used Aug 28" },
  { text: "Database migration work", meta: "3 times · last used Aug 20" },
  { text: "Bug triage", meta: "2 times · last used Aug 19" },
  { text: "CI pipeline maintenance", meta: "5 times · last used Sep 2", group: "other" },
];

const labels = {
  list: "Recent descriptions",
  count: (count: number) => `${count} suggestions`,
  empty: "No matching description",
  hint: "↑↓ to choose · ↵ to insert",
  groups: { other: "From other projects" },
};

function Demo({
  as = "input",
  initialValue = "",
  emptyStateLimit = 4,
  layout = "popover",
  invalid = false,
  disabled = false,
  items = options,
  onAccept,
}: {
  as?: "input" | "textarea";
  initialValue?: string;
  emptyStateLimit?: number;
  layout?: "popover" | "block";
  invalid?: boolean;
  disabled?: boolean;
  items?: SuggestOption[];
  onAccept?: (option: SuggestOption) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="grid gap-2">
      <label
        htmlFor="story-description"
        className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        Description
      </label>
      <SuggestInput
        id="story-description"
        as={as}
        value={value}
        options={items}
        labels={labels}
        emptyStateLimit={emptyStateLimit}
        layout={layout}
        invalid={invalid}
        disabled={disabled}
        placeholder="What did you do?"
        onValueChange={setValue}
        onAccept={onAccept}
      />
    </div>
  );
}

/**
 * The description field on `/time`, and the only free-text field in the app with a memory.
 *
 * Every story leaves at least 14rem of room below the field: the list floats over the layout on a
 * wide viewport, and a story that clips it is a story that cannot show the thing it is about.
 */
const meta = {
  title: "UI/SuggestInput",
  component: SuggestInput,
  parameters: { layout: "padded" },
  args: {
    value: "",
    options,
    labels,
    onValueChange: fn(),
    onAccept: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[26rem] pb-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SuggestInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Focus an empty field and the top few are already there — no keystroke involved. */
export const ZeroKeystroke: Story = {
  render: (args) => <Demo onAccept={args.onAccept} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Description" }));

    await expect(canvas.getAllByRole("option")).toHaveLength(4);
  },
};

/** Typing filters, and the matched slice is emphasized in place. */
export const Filtered: Story = {
  render: (args) => <Demo onAccept={args.onAccept} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("combobox", { name: "Description" }), "cod");

    await expect(canvas.getByRole("option", { name: /Code review/ })).toBeVisible();
  },
};

/**
 * The keyboard contract, as one story: down to choose, Enter to insert — and Enter does **not**
 * submit while an option is active, because a half-picked description must not log an entry.
 */
export const AcceptWithTheKeyboard: Story = {
  render: (args) => <Demo onAccept={args.onAccept} />,
  play: async ({ args, canvas, userEvent }) => {
    const field = canvas.getByRole("combobox", { name: "Description" });

    await userEvent.type(field, "spr");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    await expect(args.onAccept).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Sprint planning" }),
    );
    await expect(field).toHaveValue("Sprint planning");
  },
};

/** An unaccented query still finds the accented description — the Hungarian keyboard case. */
export const AccentInsensitive: Story = {
  render: (args) => <Demo onAccept={args.onAccept} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("combobox", { name: "Description" }), "arajanlat");

    await expect(canvas.getByRole("option", { name: /Árajánlat egyeztetés/ })).toBeVisible();
  },
};

/** Nothing remembered like this. Said out loud, rather than by showing an unfiltered list. */
export const NoMatch: Story = {
  render: (args) => <Demo onAccept={args.onAccept} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("combobox", { name: "Description" }), "invoice");

    await expect(canvas.getByText("No matching description")).toBeVisible();
  },
};

/**
 * A project with almost no history of its own borrows a few from the others — the shape a first
 * week on a new assignment produces. Borrowed rows always sit under their own heading, because a
 * description written for another project can name the wrong client.
 */
export const GroupedFallback: Story = {
  render: (args) => (
    <Demo
      onAccept={args.onAccept}
      emptyStateLimit={5}
      items={[
        { text: "Kickoff call", meta: "2 times · last used Sep 4" },
        { text: "Environment setup", meta: "1 time · last used Sep 3" },
        { text: "API endpoint implementation", meta: "18 times · last used Sep 3", group: "other" },
        { text: "Sprint planning", meta: "9 times · last used Sep 1", group: "other" },
        { text: "Code review", meta: "7 times · last used Sep 2", group: "other" },
      ]}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Description" }));

    await expect(canvas.getByText("From other projects")).toBeVisible();
  },
};

/** The entry dialog's three-row field. The arrows stay with the caret until Alt is held. */
export const Textarea: Story = {
  render: (args) => <Demo as="textarea" initialValue="Sprint planning" onAccept={args.onAccept} />,
};

export const Invalid: Story = {
  render: (args) => <Demo invalid onAccept={args.onAccept} />,
};

export const Disabled: Story = {
  render: (args) => <Demo disabled initialValue="Locked month" onAccept={args.onAccept} />,
};

export const ZeroKeystrokeLight: Story = {
  render: (args) => <Demo onAccept={args.onAccept} />,
  globals: { theme: "light" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Description" }));

    await expect(canvas.getAllByRole("option")).toHaveLength(4);
  },
};

/**
 * On a phone the list sits **in flow** under the field rather than floating: the composer is a
 * bottom sheet there, and a panel over a virtual keyboard is a trap.
 */
export const Mobile: Story = {
  render: (args) => <Demo layout="block" onAccept={args.onAccept} />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Description" }));

    await expect(canvas.getAllByRole("option")).toHaveLength(4);
  },
};
