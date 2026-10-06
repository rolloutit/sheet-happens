import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect } from "storybook/test";

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
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /^next page$/i }));
    await expect(canvas.getByText("3")).toBeVisible();
  },
};

export const FirstPage: Story = {
  args: {
    page: 1,
    totalPages: 7,
    totalItems: 124,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /^previous page$/i })).toBeDisabled();
  },
};

export const WithPageNumbers: Story = {
  render: () => {
    const [page, setPage] = useState(5);

    return (
      <Pager page={page} totalPages={12} totalItems={240} showPageNumbers onPageChange={setPage} />
    );
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole("button", { name: /current page, page 5/i })).toHaveAttribute(
      "aria-current",
      "page",
    );

    /**
     * The regression this story used to hide. The step controls were labelled after the page they
     * lead to — "Go to page 4" and "Go to page 6" — which is exactly what the numbered buttons are
     * called, so each of those names matched two buttons and the story had to reach past the
     * ambiguity with `getAllByRole(...)[0]`. Both names now resolve to one element, and the step
     * controls are named for what they do.
     */
    await expect(canvas.getAllByRole("button", { name: /go to page 6/i })).toHaveLength(1);
    await expect(canvas.getAllByRole("button", { name: /go to page 4/i })).toHaveLength(1);
    await expect(canvas.getByRole("button", { name: /^next page$/i })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /^previous page$/i })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: /go to page 6/i }));
    await expect(canvas.getByRole("button", { name: /current page, page 6/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};
