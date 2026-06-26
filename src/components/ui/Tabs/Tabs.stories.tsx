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
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("tab", { name: /timer/i })).toHaveAttribute(
      "data-state",
      "active",
    );
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
  play: async ({ canvas, userEvent }) => {
    const paid = canvas.getByRole("tab", { name: /paid/i });
    await expect(paid).toBeDisabled();
    await userEvent.click(canvas.getByRole("tab", { name: /approved/i }));
    await expect(canvas.getByText("Approved queue")).toBeVisible();
    await expect(canvas.queryByText("Paid queue")).not.toBeInTheDocument();
  },
};

export const Vertical: Story = {
  render: () => (
    <Tabs
      defaultValue="profile"
      orientation="vertical"
      className="grid max-w-2xl grid-cols-[12rem_1fr] gap-4"
    >
      <TabsList
        aria-label="Settings section"
        className="h-auto flex-col items-stretch justify-start rounded-[var(--radius-lg)]"
      >
        <TabsTrigger value="profile" className="justify-start">
          Profile
        </TabsTrigger>
        <TabsTrigger value="security" className="justify-start">
          Security
        </TabsTrigger>
        <TabsTrigger value="notifications" className="justify-start">
          Notifications
        </TabsTrigger>
      </TabsList>
      <div>
        <TabsContent value="profile" className="mt-0">
          Profile settings
        </TabsContent>
        <TabsContent value="security" className="mt-0">
          Security settings
        </TabsContent>
        <TabsContent value="notifications" className="mt-0">
          Notification settings
        </TabsContent>
      </div>
    </Tabs>
  ),
  play: async ({ canvas, userEvent }) => {
    const profile = canvas.getByRole("tab", { name: /profile/i });
    profile.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByRole("tab", { name: /security/i })).toHaveFocus();
  },
};
