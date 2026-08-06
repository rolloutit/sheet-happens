import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-ui text-sm font-semibold transition duration-200 ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The prototype's `.btn-accent`: a teal→mint gradient lit by an accent glow rather than a
        // drop shadow. A gradient can't take `hover:bg-*`, so the hover is a brightness lift.
        primary:
          "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-primary-foreground shadow-accent-glow hover:brightness-110",
        cta: "bg-cta text-cta-foreground shadow-soft hover:bg-cta-hover",
        soft: "border border-border-strong bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-secondary",
        danger: "bg-destructive-soft text-destructive hover:bg-destructive/25",
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
