import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AuthShell } from ".";

const meta = {
  title: "Layout/AuthShell",
  component: AuthShell,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    mood: "back",
    children: (
      <div>
        <div className="mb-6">
          <h2 className="font-ui text-[28px] font-semibold leading-tight text-foreground">
            Welcome back
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
            Sign in to Sheet Happens.
          </p>
        </div>
        <div className="grid gap-3">
          <div className="h-12 rounded-[var(--radius-md)] bg-accent" />
          <div className="h-12 rounded-[var(--radius-md)] border border-border bg-card" />
          <div className="h-12 rounded-[var(--radius-md)] border border-border bg-card" />
        </div>
      </div>
    ),
  },
} satisfies Meta<typeof AuthShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WelcomeBack: Story = {};

export const Invitation: Story = {
  args: {
    mood: "aboard",
  },
};

export const Reset: Story = {
  args: {
    mood: "fresh",
  },
};

export const Secure: Story = {
  args: {
    mood: "secure",
  },
};
