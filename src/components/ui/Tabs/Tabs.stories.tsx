import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { Tabs, TabsContent, TabsList, TabsTrigger } from ".";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <Tabs defaultValue="grid" className="w-full max-w-lg">
      <TabsList aria-label="Time tracking view">
        <TabsTrigger value="grid">Grid</TabsTrigger>
        <TabsTrigger value="day">Day</TabsTrigger>
        <TabsTrigger value="timer">Timer</TabsTrigger>
      </TabsList>
      <TabsContent value="grid">Weekly grid view</TabsContent>
      <TabsContent value="day">Day detail view</TabsContent>
      <TabsContent value="timer">Live timer view</TabsContent>
    </Tabs>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("tab", { name: /day/i }));
    await expect(canvas.getByText("Day detail view")).toBeVisible();
  },
};

export const DisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="submitted" className="w-full max-w-lg">
      <TabsList aria-label="Review queue status">
        <TabsTrigger value="submitted">Submitted</TabsTrigger>
        <TabsTrigger value="approved">Approved</TabsTrigger>
        <TabsTrigger value="paid" disabled>
          Paid
        </TabsTrigger>
      </TabsList>
      <TabsContent value="submitted">Submitted queue</TabsContent>
      <TabsContent value="approved">Approved queue</TabsContent>
      <TabsContent value="paid">Paid queue</TabsContent>
    </Tabs>
  ),
};
