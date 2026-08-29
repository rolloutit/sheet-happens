import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-ui text-sm font-semibold transition duration-200 ease-[var(--ease-standard)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The prototype's `.btn-accent`: a teal→mint gradient lit by an accent glow rather than a
        // drop shadow. A gradient can't take `hover:bg-*`, so the hover is a brightness lift.
        // `shadow-accent-glow` now resolves to a glow that is actually visible (see
        // `--elevation-glow`), which is most of why this button reads as lit rather than flat.
        primary:
          "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-primary-foreground shadow-accent-glow hover:brightness-110",
        // The CTA is brand-mandated peach and stays peach — but it is the one warm control on the
        // screen, so it gets the warm glow rather than the neutral drop shadow, and the same
        // gradient treatment as `primary` so the two read as a pair. `--cta-hover` is the darker,
        // more saturated end of the brand's peach ladder, which makes it the gradient's far stop;
        // the hover is a brightness lift because a gradient cannot take `hover:bg-*`.
        cta: "bg-[linear-gradient(135deg,var(--cta),var(--cta-hover))] text-cta-foreground shadow-cta-glow hover:brightness-105",
        soft: "border border-border-strong bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-secondary",
        // The label sits on a rose tint, so it takes the lighter rose step — `--destructive` is
        // the fill colour and drops below 4.5:1 on its own tint at this alpha.
        danger:
          "border border-destructive/45 bg-destructive-soft text-destructive-bright hover:bg-destructive/30",
        link: "h-auto rounded-none px-0 py-0 text-accent underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-base",
        icon: "size-10 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
