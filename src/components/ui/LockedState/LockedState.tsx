import { LockKeyhole } from "lucide-react";

import { cn } from "@/src/lib/utils";
import type { LockedStateProps } from "./LockedState.types";

export function LockedState({ title, reason, meta, action, className }: LockedStateProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/70 p-4",
        className,
      )}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <LockKeyhole className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ui text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{reason}</p>
        {meta ? (
          <p className="mt-2 font-ui text-xs font-semibold text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
