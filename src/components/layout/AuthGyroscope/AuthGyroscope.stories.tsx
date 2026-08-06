import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { AuthGyroscope } from ".";

/** Walks nested `@layer` and `@media` blocks, which is where Tailwind keeps most of its output. */
function findRule(rules: CSSRuleList, selector: string): CSSStyleRule | undefined {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule && rule.selectorText === selector) return rule;
    if ("cssRules" in rule) {
      const nested = findRule((rule as CSSGroupingRule).cssRules, selector);
      if (nested) return nested;
    }
  }
  return undefined;
}

/**
 * The cage only ever sits on the auth panel's teal gradient, which stays teal in both themes, so
 * every story supplies that surface rather than the story background.
 */
const meta = {
  title: "Layout/AuthGyroscope",
  component: AuthGyroscope,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="relative h-[34rem] w-full overflow-hidden bg-[radial-gradient(120%_90%_at_18%_8%,#2c7c7c_0%,#0c423f_55%,#08302d_100%)]">
        <Story />
      </div>
    ),
  ],
  args: {
    // Centred by offsetting half the cage, never by `-translate-*`: the drift animates `translate`,
    // and an animation outranks a utility, so a translate-based centring would be thrown away.
    className: "absolute left-[calc(50%_-_15rem)] top-[calc(50%_-_15rem)] size-[30rem]",
  },
} satisfies Meta<typeof AuthGyroscope>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Whole cage, centred — the arrangement the panel crops rather than the one it ships. */
export const Centered: Story = {
  play: async ({ canvasElement }) => {
    const cage = canvasElement.querySelector(".auth-gyro");
    await expect(cage).toHaveAttribute("aria-hidden", "true");

    // The hub renders `BrandMark`, whose `alt` is "Rollout IT" — decorative here, and only kept out
    // of the accessibility tree by the `aria-hidden` above.
    await expect(canvasElement.querySelector("img[alt='Rollout IT']")).toBeInTheDocument();

    // Three layers are hidden below `lg` by a `hidden` utility, and Tailwind emits that inside
    // `@layer utilities`, which every unlayered rule in `globals.css` outranks. So `.auth-gyro-layer`
    // must never declare `display` itself: doing so would silently pin all six layers visible at
    // every width. Asserted against the stylesheet because no viewport can observe the clash.
    const rule = [...document.styleSheets].reduce<CSSStyleRule | undefined>(
      (found, sheet) => found ?? findRule(sheet.cssRules, ".auth-gyro-layer"),
      undefined,
    );
    await expect(rule, ".auth-gyro-layer rule not found in any stylesheet").toBeDefined();
    await expect(rule?.style.display).toBe("");
  },
};

/**
 * How the auth panel actually places it, in a frame the size of the panel at a 1440×900 window: hub
 * parked in the clear band at 74% height, cage bleeding out both sides. Drifting, so where the hub
 * sits depends on when you look.
 */
export const PanelPlacement: Story = {
  decorators: [
    (Story) => (
      <div className="relative h-[900px] w-[620px] overflow-hidden bg-[radial-gradient(120%_90%_at_18%_8%,#2c7c7c_0%,#0c423f_55%,#08302d_100%)]">
        <Story />
      </div>
    ),
  ],
  args: {
    className: "absolute left-[calc(50%_-_18rem)] top-[calc(74%_-_18rem)] size-[36rem]",
  },
};

/**
 * Below `lg` the hub, the sweep and the inner ring drop out and the short banner crops the rest to
 * arcs. Those three are hidden by `lg:` utilities, which answer to the viewport and not to the
 * container — so this story narrows the viewport rather than shrinking a wrapper.
 */
export const MobileBanner: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  decorators: [
    (Story) => (
      <div className="relative h-[13rem] w-full overflow-hidden bg-[radial-gradient(120%_90%_at_18%_8%,#2c7c7c_0%,#0c423f_55%,#08302d_100%)]">
        <Story />
      </div>
    ),
  ],
  args: {
    className: "absolute left-[calc(100%_-_12.5rem)] top-[calc(50%_-_8.5rem)] size-[17rem]",
  },
};
