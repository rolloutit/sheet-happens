import { cva } from "class-variance-authority";

// An empty state is mostly negative space, so it is the one surface where the atmosphere's
// language can be brought inside without competing with content — each tone carries a soft corner
// glow of its own hue over the flat fill.
//
// `default` was `bg-card/70`, which broke the opaque-surface rule in `docs/tokens.md` twice over:
// a translucent card samples whatever canvas happens to sit behind it, so it never landed on its
// intended colour, and at 70% over a near-black void it landed washed and grey. It is now an
// opaque card with the glow doing the lifting.
export const emptyStateVariants = cva(
  "rounded-[var(--radius-xl)] border p-6 text-center shadow-soft sm:p-8",
  {
    variants: {
      tone: {
        default:
          "border-border bg-[radial-gradient(120%_140%_at_50%_0%,var(--accent-soft),transparent_58%),var(--card)]",
        warm: "border-cta/40 bg-[radial-gradient(120%_140%_at_50%_0%,color-mix(in_srgb,var(--cta)_22%,transparent),transparent_58%),var(--card)]",
        good: "border-success/40 bg-[radial-gradient(120%_140%_at_50%_0%,var(--success-soft),transparent_58%),var(--card)]",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  },
);
