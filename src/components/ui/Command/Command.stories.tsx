import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect } from "storybook/test";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from ".";

const projects = [
  { value: "arvizturo", label: "Árvíztűrő Kft.", meta: "Client project" },
  { value: "helix", label: "Helix Support", meta: "Managed service" },
  { value: "internal", label: "Internal Operations", meta: "Overhead" },
];

const meta = {
  title: "UI/Command",
  component: Command,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The searchable list behind Combobox and the command palette. Search is a substring match rather than a fuzzy one, and it folds diacritics so `arvizturo` finds `Árvíztűrő`.",
      },
    },
  },
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Reports the chosen value on screen rather than through a spy, so the stories can assert
 * that selection carries the real value and not cmdk's lowercased copy of it.
 */
function ProjectList() {
  const [selected, setSelected] = useState<string>();

  return (
    <div className="grid w-80 gap-3">
      <div className="rounded-[var(--radius-lg)] border border-border-strong p-2 shadow-panel">
        <Command label="Search projects">
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No projects found</CommandEmpty>
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project.value}
                  value={project.value}
                  keywords={[project.label, project.meta]}
                  // cmdk lowercases the value it hands back, so close over the real one.
                  onSelect={() => setSelected(project.value)}
                >
                  <span className="grid gap-0.5">
                    <span className="font-medium">{project.label}</span>
                    <span className="text-xs text-muted-foreground">{project.meta}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
      <p className="font-ui text-sm text-muted-foreground">
        Selected: <output>{selected ?? "none"}</output>
      </p>
    </div>
  );
}

export const Basic: Story = {
  render: () => <ProjectList />,
};

export const AccentFoldedSearch: Story = {
  render: () => <ProjectList />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("combobox", { name: /search projects/i }), "arvizturo");

    await expect(canvas.getByRole("option", { name: /árvíztűrő/i })).toBeVisible();
    await expect(canvas.queryByRole("option", { name: /helix/i })).not.toBeInTheDocument();
  },
};

export const SearchesSecondaryText: Story = {
  render: () => <ProjectList />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("combobox", { name: /search projects/i }), "managed");

    await expect(canvas.getByRole("option", { name: /helix support/i })).toBeVisible();
    await expect(canvas.queryByRole("option", { name: /internal/i })).not.toBeInTheDocument();
  },
};

export const NoFuzzyMatches: Story = {
  render: () => <ProjectList />,
  play: async ({ canvas, userEvent }) => {
    // A fuzzy scorer would surface "Marketing"-style scattered hits; this one must not.
    await userEvent.type(canvas.getByRole("combobox", { name: /search projects/i }), "hlx");

    await expect(canvas.getByText(/no projects found/i)).toBeVisible();
  },
};

export const EmptyResults: Story = {
  render: () => <ProjectList />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("combobox", { name: /search projects/i }), "payroll");

    await expect(canvas.getByText(/no projects found/i)).toBeVisible();
  },
};

export const KeyboardSelection: Story = {
  render: () => <ProjectList />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /search projects/i }));
    await userEvent.keyboard("{ArrowDown}{Enter}");

    await expect(canvas.getByRole("status")).toHaveTextContent("helix");
  },
};
