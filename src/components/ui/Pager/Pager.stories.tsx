import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { Pager } from ".";

const meta = {
  title: "UI/Pager",
  component: Pager,
  args: {
    page: 1,
    totalPages: 3,
  },
} satisfies Meta<typeof Pager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [page, setPage] = useState(2);

    return <Pager page={page} totalPages={7} totalItems={124} onPageChange={setPage} />;
  },
};
