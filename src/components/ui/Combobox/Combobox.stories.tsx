import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, screen, waitFor } from "storybook/test";

import { Button } from "../Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../Dialog";
import { Combobox } from ".";

const options = [
  { value: "apollo", label: "Apollo Migration", meta: "Client project" },
  { value: "helix", label: "Helix Support", meta: "Managed service" },
  { value: "arvizturo", label: "Árvíztűrő Kft.", meta: "Client project" },
  { value: "internal", label: "Internal Operations", meta: "Overhead" },
];

const meta = {
  title: "UI/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  args: {
    label: "Project",
    options,
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The search field and the trigger both report `role="combobox"` — cmdk hardcodes it. */
const trigger = { role: "combobox" as const, name: /project/i };
const search = { role: "combobox" as const, name: /search/i };

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
    await userEvent.click(canvas.getByRole(trigger.role, { name: trigger.name }));
    await userEvent.type(screen.getByRole(search.role, { name: search.name }), "helix");

    await userEvent.click(screen.getByRole("option", { name: /helix support/i }));
    await expect(canvas.getByRole(trigger.role, { name: trigger.name })).toHaveTextContent(
      /helix/i,
    );
  },
};

export const AccentInsensitiveSearch: Story = {
  render: () => (
    <div className="w-80">
      <Combobox label="Project" options={options} placeholder="Select project" />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole(trigger.role, { name: trigger.name }));
    // Typed without accents; the Hungarian name must still match.
    await userEvent.type(screen.getByRole(search.role, { name: search.name }), "arvizturo");

    await expect(screen.getByRole("option", { name: /árvíztűrő/i })).toBeVisible();
  },
};

export const EmptyResults: Story = {
  render: () => (
    <div className="w-80">
      <Combobox label="Project" options={options} labels={{ empty: "No projects found" }} />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole(trigger.role, { name: trigger.name }));
    await userEvent.type(screen.getByRole(search.role, { name: search.name }), "payroll");

    await expect(screen.getByText(/no projects found/i)).toBeVisible();
  },
};

export const DisabledOption: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <div className="w-80">
      <Combobox
        label="Project"
        onValueChange={args.onValueChange}
        options={[options[0]!, { value: "locked", label: "Locked Project", disabled: true }]}
      />
    </div>
  ),
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole(trigger.role, { name: trigger.name }));
    await userEvent.type(screen.getByRole(search.role, { name: search.name }), "locked");

    await expect(screen.getByRole("option", { name: /locked project/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.keyboard("{Enter}");
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const KeyboardSelection: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <div className="w-80">
      <Combobox
        label="Project"
        value="apollo"
        onValueChange={args.onValueChange}
        options={options}
      />
    </div>
  ),
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole(trigger.role, { name: trigger.name }));
    // Focus moves on the next frame, so it deliberately lags the click.
    await waitFor(() => expect(screen.getByRole(search.role, { name: search.name })).toHaveFocus());

    await userEvent.keyboard("{ArrowDown}{Enter}");
    // Opening highlights the current choice, so one step down lands on the next option.
    await expect(args.onValueChange).toHaveBeenCalledWith("helix");

    await waitFor(() =>
      expect(canvas.getByRole(trigger.role, { name: trigger.name })).toHaveFocus(),
    );
  },
};

export const EscapeReturnsFocus: Story = {
  render: () => (
    <div className="w-80">
      <Combobox label="Project" options={options} placeholder="Select project" />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole(trigger.role, { name: trigger.name }));
    await expect(screen.getByRole(search.role, { name: search.name })).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole(search.role, { name: search.name })).not.toBeInTheDocument(),
    );
    await expect(canvas.getByRole(trigger.role, { name: trigger.name })).toHaveFocus();
  },
};

/**
 * The riskiest composition: the timezone and currency pickers live inside a Drawer, and the
 * popover portals outside that Dialog's focus scope. Without `modal`, focus snaps back to
 * the dialog the moment the panel opens and the control is unusable.
 */
export const InsideDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Edit member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
        </DialogHeader>
        <Combobox label="Project" options={options} placeholder="Select project" />
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /edit member/i }));
    await userEvent.click(screen.getByRole(trigger.role, { name: trigger.name }));

    const searchField = screen.getByRole(search.role, { name: search.name });
    await waitFor(() => expect(searchField).toHaveFocus());

    await userEvent.type(searchField, "helix");
    await userEvent.click(screen.getByRole("option", { name: /helix support/i }));
    await expect(screen.getByRole(trigger.role, { name: trigger.name })).toHaveTextContent(
      /helix/i,
    );
  },
};

/**
 * Uncontrolled use inside a Server Action form. The hidden `<select>` is what carries the
 * value into `FormData`, and it follows `form.reset()` like a native control.
 */
export const SubmitsInAForm: Story = {
  render: () => {
    const [submitted, setSubmitted] = useState<string>();

    return (
      <form
        className="grid w-80 gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(String(new FormData(event.currentTarget).get("projectId")));
        }}
      >
        <Combobox
          label="Project"
          name="projectId"
          defaultValue="apollo"
          options={options}
          placeholder="Select project"
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
          Submitted: <output>{submitted ?? "nothing"}</output>
        </p>
      </form>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole(trigger.role, { name: trigger.name }));
    await userEvent.click(screen.getByRole("option", { name: /helix support/i }));
    await userEvent.click(canvas.getByRole("button", { name: /submit/i }));
    await expect(canvas.getByRole("status")).toHaveTextContent("helix");

    // Resetting the form must pull the trigger back to its defaultValue, not strand it.
    await userEvent.click(canvas.getByRole("button", { name: /reset/i }));
    await waitFor(() =>
      expect(canvas.getByRole(trigger.role, { name: trigger.name })).toHaveTextContent(/apollo/i),
    );
  },
};
