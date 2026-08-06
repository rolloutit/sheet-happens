import { cva } from "class-variance-authority";

export const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border font-ui font-semibold",
  {
    variants: {
      size: {
        sm: "size-8 text-xs",
        md: "size-10 text-sm",
        lg: "size-12 text-base",
        xl: "size-16 text-lg",
      },
      tone: {
        // The prototype's avatar is a teal→mint gradient under a soft accent glow
        // (`.rv-av`, `.set-avbig`), not a flat tint.
        teal: "border-transparent bg-[linear-gradient(150deg,var(--primary),var(--accent))] text-primary-foreground shadow-[0_6px_20px_-8px_var(--accent-line)]",
        amber: "bg-cta/20 text-cta",
        deep: "bg-secondary text-foreground",
        peach: "bg-warning-soft text-warning",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "teal",
    },
  },
);
