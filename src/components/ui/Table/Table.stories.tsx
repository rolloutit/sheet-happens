import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";

import { Badge } from "../Badge";
import { Button } from "../Button";
import { DataTable } from ".";

type Person = {
  id: string;
  name: string;
  profile: string;
  state: string;
  hours: number;
};

const rows: Person[] = [
  { id: "1", name: "Lena Kovacs", profile: "Contractor", state: "Active", hours: 132 },
  { id: "2", name: "Mark Chen", profile: "Employee", state: "Inactive", hours: 96 },
];

const meta = {
  title: "UI/Table",
  component: DataTable<Person>,
  args: {
    rows,
    getRowKey: (row) => row.id,
    columns: [
      { id: "name", header: "Name", accessor: "name" },
      { id: "profile", header: "Profile", accessor: "profile" },
    ],
  },
} satisfies Meta<typeof DataTable<Person>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DataTable
      caption="People and time summary"
      rows={rows}
      getRowKey={(row) => row.id}
      columns={[
        { id: "name", header: "Name", accessor: "name" },
        {
          id: "profile",
          header: "Profile",
          cell: (row) => <Badge tone="cta">{row.profile}</Badge>,
        },
        { id: "state", header: "State", cell: (row) => <Badge dot>{row.state}</Badge> },
        { id: "hours", header: "Hours", accessor: "hours", align: "right" },
      ]}
    />
  ),
};

export const ClickableRows: Story = {
  args: {
    onRowClick: fn(),
  },
  render: (args) => (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      rowActionLabel={(row) => `Open ${row.name}`}
      onRowClick={args.onRowClick}
      columns={[
        { id: "name", header: "Name", accessor: "name" },
        { id: "profile", header: "Profile", accessor: "profile" },
      ]}
    />
  ),
  play: async ({ args, canvas, userEvent }) => {
    const row = canvas.getByRole("button", { name: /open lena kovacs/i });
    await userEvent.tab();
    await expect(row).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onRowClick).toHaveBeenCalledWith(rows[0]);
  },
};

export const ServerSorted: Story = {
  args: {
    sort: { columnId: "hours", direction: "descending" },
    onSortChange: fn(),
  },
  render: (args) => (
    <DataTable
      aria-label="People time report"
      rows={rows}
      getRowKey={(row) => row.id}
      sort={args.sort}
      onSortChange={args.onSortChange}
      columns={[
        { id: "name", header: "Name", accessor: "name" },
        { id: "profile", header: "Profile", accessor: "profile" },
        { id: "hours", header: "Hours", accessor: "hours", align: "right", sortable: true },
      ]}
    />
  ),
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("table", { name: /people time report/i })).toBeVisible();
    const hoursHeader = canvas.getByRole("columnheader", { name: /hours/i });
    await expect(hoursHeader).toHaveAttribute("aria-sort", "descending");

    await userEvent.click(canvas.getByRole("button", { name: /sort by hours ascending/i }));
    await expect(args.onSortChange).toHaveBeenCalledWith({
      columnId: "hours",
      direction: "ascending",
    });
  },
};

export const MobileCards: Story = {
  render: () => (
    <DataTable
      displayMode="cards"
      rows={rows}
      getRowKey={(row) => row.id}
      rowActionLabel={(row) => `Open mobile ${row.name}`}
      onRowClick={() => undefined}
      columns={[
        { id: "name", header: "Name", accessor: "name", mobileLabel: "Person" },
        { id: "profile", header: "Profile", accessor: "profile" },
        { id: "hours", header: "Hours", accessor: "hours", align: "right" },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    const card = canvas.getByRole("button", { name: /open mobile lena kovacs/i });
    const insideCard = within(card);
    await expect(insideCard.getByText("Person")).toBeVisible();
    await expect(insideCard.getByText("Lena Kovacs")).toBeVisible();
    await expect(insideCard.getByText("Profile")).toBeVisible();
  },
};

export const RowActions: Story = {
  args: {
    onRowClick: fn(),
  },
  render: (args) => (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={args.onRowClick}
      rowActions={(row) => (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={() => args.onRowClick?.(row)}>
            Edit
          </Button>
          <Button type="button" variant="danger" size="sm">
            Delete
          </Button>
        </>
      )}
      columns={[
        { id: "name", header: "Name", accessor: "name" },
        { id: "profile", header: "Profile", accessor: "profile" },
      ]}
    />
  ),
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getAllByRole("button", { name: /edit/i })[0]);
    await expect(args.onRowClick).toHaveBeenCalledWith(rows[0]);
  },
};

export const Loading: Story = {
  render: () => (
    <DataTable
      loading
      rows={[] as Person[]}
      getRowKey={(row) => String(row.id)}
      columns={[
        { id: "name", header: "Name", accessor: "name" },
        { id: "profile", header: "Profile", accessor: "profile" },
      ]}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      rows={[] as Person[]}
      getRowKey={(row) => String(row.id)}
      empty="No people match the current filters."
      columns={[
        { id: "name", header: "Name", accessor: "name" },
        { id: "profile", header: "Profile", accessor: "profile" },
      ]}
    />
  ),
};
