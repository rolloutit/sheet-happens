import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Archive, Edit3, MoreHorizontal } from "lucide-react";
import { expect, fn } from "storybook/test";

import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/src/components/ui/Dropdown";
import { IconButton } from "@/src/components/ui/IconButton";
import { PROJECT_COLOR_TOKENS } from "@/src/lib/project-colors";
import { ProjectGroupsTable } from ".";
import type { ProjectGroupTableRow } from "./ProjectGroupsTable.types";

const labels = {
  caption: "Project groups table",
  ariaLabel: "Project groups table",
  openGroup: (row: ProjectGroupTableRow) => `Open ${row.name}`,
  rowActionsLabel: "Actions",
  columns: { group: "Group", projects: "Projects", state: "State", updated: "Updated" },
  states: { active: "Active", inactive: "Inactive" },
  noProjects: "No projects in this group.",
  projectCount: (count: number) => (count === 1 ? "1 project" : `${count} projects`),
  moreProjects: (count: number) => `+${count} more`,
};

const rows: ProjectGroupTableRow[] = [
  {
    id: "client-delivery",
    name: "Client Delivery",
    slug: "client-delivery",
    description: "Billable client-facing work",
    active: true,
    projectCount: 7,
    projects: [
      { id: "1", name: "Atlas Platform", colorToken: "teal" },
      { id: "2", name: "Aurora Billing", colorToken: "blue" },
      { id: "3", name: "Fenix Data Pipeline", colorToken: "mint" },
      { id: "4", name: "Horizon Redesign", colorToken: "amber" },
      { id: "5", name: "Nimbus Mobile App", colorToken: "cyan" },
      { id: "6", name: "Orion Legacy Migration", colorToken: "rose" },
      { id: "7", name: "Vega Integration", colorToken: "violet" },
    ],
    updatedAtLabel: "Aug 28, 2026, 2:00 PM",
  },
  {
    id: "internal",
    name: "Internal",
    slug: "internal",
    description: "Non-billable internal work",
    active: true,
    projectCount: 1,
    projects: [{ id: "8", name: "Internal Ops & Tooling", colorToken: "slate" }],
    updatedAtLabel: "Aug 25, 2026, 9:15 AM",
  },
];

function RowActions({ row }: { row: ProjectGroupTableRow }) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton
          icon={MoreHorizontal}
          label={`Open actions for ${row.name}`}
          size="sm"
          variant="ghost"
        />
      </DropdownTrigger>
      <DropdownContent align="end">
        <DropdownItem onSelect={() => {}}>Manage projects</DropdownItem>
        <DropdownItem onSelect={() => {}}>
          <Edit3 className="size-4" aria-hidden="true" />
          Edit group
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem tone="danger" onSelect={() => {}}>
          <Archive className="size-4" aria-hidden="true" />
          Archive
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

const meta = {
  title: "Sheet/ProjectGroupsTable",
  component: ProjectGroupsTable,
  globals: {
    theme: "light",
    locale: "en",
  },
  args: {
    rows,
    labels,
    onOpenGroup: fn(),
    rowActions: (row: ProjectGroupTableRow) => <RowActions row={row} />,
  },
} satisfies Meta<typeof ProjectGroupsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open Client Delivery" }));
    await expect(args.onOpenGroup).toHaveBeenCalledWith(rows[0]);
  },
};

export const Dark: Story = {
  globals: { theme: "dark" },
};

export const SingleGroup: Story = {
  args: { rows: [rows[1]] },
};

export const Sortable: Story = {
  args: {
    sort: { columnId: "name", direction: "ascending" },
    onSortChange: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /sort by updated ascending/i }));
    await expect(args.onSortChange).toHaveBeenCalledWith({
      columnId: "updated",
      direction: "ascending",
    });
  },
};

export const Loading: Story = {
  args: { loading: true },
};

export const EmptyNoGroups: Story = {
  args: {
    rows: [],
    labels: { ...labels, empty: "No project groups have been created yet." },
  },
};

export const EmptyFiltered: Story = {
  args: {
    rows: [],
    labels: { ...labels, empty: "No project groups match the current filters." },
  },
};

/** A long name and description clamp instead of pushing the row taller. */
export const LongContent: Story = {
  args: {
    rows: [
      {
        ...rows[0],
        name: "Client Delivery — Enterprise Accounts and Renewal Programs",
        description:
          "Every billable engagement across enterprise accounts, including renewal and expansion work that spans multiple fiscal quarters and several regional teams.",
      },
    ],
  },
};

/** A group touching all thirteen project color tokens — checks swatch folding at six. */
export const ManyColors: Story = {
  args: {
    rows: [
      {
        ...rows[0],
        projectCount: PROJECT_COLOR_TOKENS.length,
        projects: PROJECT_COLOR_TOKENS.map((token, index) => ({
          id: `color-${token}`,
          name: `Project ${index + 1}`,
          colorToken: token,
        })),
      },
    ],
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
