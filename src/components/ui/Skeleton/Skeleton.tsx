import { cn } from "@/src/lib/utils";
import type { SkeletonProps } from "./Skeleton.types";

// The prototype's `.sk` sweeps a sheen across the skeleton rather than pulsing its opacity.
// `.sheet-shimmer` carries the gradient and keyframes (app/globals.css).
const shimmer = "sheet-shimmer";

export function Skeleton({ variant = "line", lines = 3, className, ...props }: SkeletonProps) {
  if (variant === "table") {
    return (
      <div className={cn("grid gap-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-4 gap-3 rounded-[var(--radius-md)] border border-border p-3"
          >
            <span className={cn("h-4 rounded", shimmer)} />
            <span className={cn("h-4 rounded", shimmer)} />
            <span className={cn("h-4 rounded", shimmer)} />
            <span className={cn("h-4 rounded", shimmer)} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "document") {
    return (
      <div
        className={cn("mx-auto grid aspect-[3/4] max-w-sm gap-4 rounded bg-card p-8", className)}
        {...props}
      >
        <span className={cn("h-8 w-1/2 rounded", shimmer)} />
        {Array.from({ length: 8 }).map((_, index) => (
          <span key={index} className={cn("h-4 rounded", shimmer, index % 3 === 0 && "w-3/4")} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        shimmer,
        variant === "line" && "h-4 w-full rounded",
        variant === "block" && "h-24 rounded-[var(--radius-lg)]",
        variant === "card" && "h-40 rounded-[var(--radius-lg)] border border-border",
        variant === "circle" && "size-10 rounded-full",
        variant === "chart" && "h-56 rounded-[var(--radius-lg)]",
        className,
      )}
      {...props}
    />
  );
}
