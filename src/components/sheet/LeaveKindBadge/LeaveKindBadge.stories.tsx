import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LeaveKindBadge } from ".";

const meta = {
  title: "Sheet/LeaveKindBadge",
  component: LeaveKindBadge,
  parameters: { layout: "padded" },
  args: { kind: "vacation", label: "Vacation" },
} satisfies Meta<typeof LeaveKindBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vacation: Story = {};

export const Sick: Story = { args: { kind: "sick", label: "Sick leave" } };

/** A colleague's leave: the reason is withheld, so the badge says only that they are away. */
export const Absent: Story = { args: { kind: "absent", label: "Away" } };

export const AllKinds: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <LeaveKindBadge kind="vacation" label="Vacation" />
      <LeaveKindBadge kind="sick" label="Sick leave" />
      <LeaveKindBadge kind="absent" label="Away" />
      <LeaveKindBadge kind="vacation" label="Vacation" size="sm" />
      <LeaveKindBadge kind="sick" label="Sick leave" size="sm" />
      <LeaveKindBadge kind="absent" label="Away" size="sm" />
    </div>
  ),
};
