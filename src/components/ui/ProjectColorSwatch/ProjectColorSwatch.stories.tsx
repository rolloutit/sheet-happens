import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PROJECT_COLOR_TOKENS } from "@/src/lib/project-colors";
import { ProjectColorSwatch } from ".";

const meta = {
  title: "UI/ProjectColorSwatch",
  component: ProjectColorSwatch,
  args: {
    colorToken: "teal",
  },
} satisfies Meta<typeof ProjectColorSwatch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <ProjectColorSwatch colorToken="mint" size="sm" />
      <ProjectColorSwatch colorToken="mint" size="md" />
      <ProjectColorSwatch colorToken="mint" size="lg" />
    </div>
  ),
};

/** All thirteen tokens, including the five added alongside the group redesign. */
export const AllTokens: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {PROJECT_COLOR_TOKENS.map((token) => (
        <div key={token} className="flex items-center gap-1.5">
          <ProjectColorSwatch colorToken={token} size="lg" />
          <span className="text-xs text-muted-foreground">{token}</span>
        </div>
      ))}
    </div>
  ),
};
