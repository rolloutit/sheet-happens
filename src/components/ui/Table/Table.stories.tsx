import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "../Badge";
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
