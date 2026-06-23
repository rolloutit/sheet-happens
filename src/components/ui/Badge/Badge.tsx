import { cn } from "@/src/lib/utils";
import type { BadgeProps } from "./Badge.types";
import { badgeVariants } from "./Badge.variants";

export function Badge({ tone, dot, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
