import { cva } from "class-variance-authority";

export const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border font-ui font-semibold ring-1 ring-white/5",
  {
    variants: {
      size: {
        sm: "size-8 text-xs",
        md: "size-10 text-sm",
        lg: "size-12 text-base",
        xl: "size-16 text-lg",
      },
      tone: {
        teal: "bg-primary/18 text-accent",
        amber: "bg-cta/20 text-cta",
        deep: "bg-secondary text-foreground",
        peach: "bg-warning/20 text-warning",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "teal",
    },
  },
);
