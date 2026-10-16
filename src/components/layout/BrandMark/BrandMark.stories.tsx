import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import type { OrgBranding } from "@/src/lib/branding";

import { BrandMark } from ".";

/** Inline SVGs stand in for an organisation's own files, so the stories need no asset on disk. */
const svg = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${fill}"/></svg>`,
  )}`;

const acme: OrgBranding = {
  name: "Acme Corp",
  logo: svg("#1f3a8a"),
  logoDark: svg("#bfd1ff"),
};

const noOrg: OrgBranding = { name: null, logo: null, logoDark: null };

const meta = {
  title: "Layout/BrandMark",
  component: BrandMark,
  tags: ["autodocs"],
  args: { org: noOrg },
  decorators: [
    (Story, { args }) => (
      <div className="flex items-center gap-3 bg-sidebar p-6">
        <Story />
        <div className="leading-tight">
          <p className="text-base font-semibold">Sheet Happens</p>
          {args.org?.name ? (
            <p className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {args.org.name}
            </p>
          ) : null}
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof BrandMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No organisation configured: the product's own pictogram, in the palette's primary. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    // Decorative: the wordmark beside it already names the product.
    await expect(canvasElement.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
    await expect(canvasElement.querySelector("img")).not.toBeInTheDocument();
  },
};

/** The default mark on a surface that stays dark in both themes. */
export const DefaultOnDark: Story = {
  args: {
    size: 24,
    tone: "onDark",
  },
  globals: {
    theme: "light",
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-3 bg-[radial-gradient(120%_90%_at_18%_8%,#2c7c7c_0%,#0c423f_55%,#08302d_100%)] p-6">
        <span className="grid size-10 place-items-center rounded-[var(--radius-md)] border border-white/20 bg-white/12">
          <Story />
        </span>
        <p className="font-ui text-[17px] font-semibold text-[#eafbfa]">Sheet Happens</p>
      </div>
    ),
  ],
};

/** A custom organisation, dark theme: the dark-surface logo is the one painted. */
export const CustomOrgDark: Story = {
  args: { org: acme },
  globals: {
    theme: "dark",
  },
  play: async ({ canvas }) => {
    // Both files are always in the markup, but only the painted one is exposed to the tree.
    const marks = canvas.getAllByRole("img", { name: "Acme Corp" });

    await expect(marks).toHaveLength(1);
    await expect(marks[0]).toHaveAttribute(
      "src",
      expect.stringContaining(encodeURIComponent("#bfd1ff")),
    );
  },
};

/** A custom organisation, light theme: the light-surface logo is the one painted. */
export const CustomOrgLight: Story = {
  args: { org: acme },
  globals: {
    theme: "light",
  },
  play: async ({ canvas }) => {
    const marks = canvas.getAllByRole("img", { name: "Acme Corp" });

    await expect(marks).toHaveLength(1);
    await expect(marks[0]).toHaveAttribute(
      "src",
      expect.stringContaining(encodeURIComponent("#1f3a8a")),
    );
  },
};

/**
 * The auth panel's teal gradient stays dark in both themes, so `onDark` pins the dark-surface logo
 * there — `auto` would paint the light-surface one onto near-black teal in the light theme.
 */
export const CustomOrgOnDark: Story = {
  args: {
    org: acme,
    size: 24,
    tone: "onDark",
  },
  globals: {
    theme: "light",
  },
  decorators: DefaultOnDark.decorators,
  play: async ({ canvas }) => {
    // Light theme, yet the dark-surface logo is what paints — and it is the only one in the markup.
    const marks = canvas.getAllByRole("img", { name: "Acme Corp" });

    await expect(marks).toHaveLength(1);
    await expect(marks[0]).toHaveAttribute(
      "src",
      expect.stringContaining(encodeURIComponent("#bfd1ff")),
    );
  },
};

/** The collapsed sidebar and the mobile drawer trigger show the mark without a wordmark. */
export const Standalone: Story = {
  args: {
    size: 32,
  },
  decorators: [
    (Story) => (
      <div className="grid w-[76px] place-items-center bg-sidebar py-4">
        <Story />
      </div>
    ),
  ],
};
