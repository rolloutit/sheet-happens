import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Atmosphere } from ".";

const meta = {
  title: "Layout/Atmosphere",
  component: Atmosphere,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The decorative brand layer `AppShell` and `AuthShell` render behind their content: " +
          "the styleguide's blob silhouettes as gradient-lit glows with outline echoes, a wave " +
          "ridge, a line-art swoosh, a gutter dot lattice, and the grain that keeps the aurora " +
          "from banding. Both themes: the geometry is shared and only the `--atmo-*` values " +
          "differ, so dark reads the shapes as light and light reads them as printed ink. Only " +
          "the grain is dark-only — banding is a near-black artifact.",
      },
    },
  },
} satisfies Meta<typeof Atmosphere>;

export default meta;
type Story = StoryObj<typeof meta>;

/* Mirrors how the shells mount it: a positioned, canvas-painted container with the atmosphere
   first and the content lifted to `z-index: 2`. The card proves opaque surfaces stay clean. */
export const OverCanvas: Story = {
  render: () => (
    <div className="sheet-canvas relative min-h-[32rem] overflow-hidden">
      <Atmosphere />
      <div className="relative z-[2] p-10">
        <div className="sheet-panel max-w-md rounded-[var(--radius-lg)] p-6">
          <p className="font-ui text-base font-semibold">Opaque surface</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The atmosphere is a gutter phenomenon: it lives in the margins and never shows through
            cards, tables, or panels.
          </p>
        </div>
      </div>
    </div>
  ),
};
