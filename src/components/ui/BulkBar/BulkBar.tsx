import { cn } from "@/src/lib/utils";
import type { BulkBarProps } from "./BulkBar.types";

export function BulkBar({
  selectedCount,
  primaryAction,
  secondaryAction,
  summary,
  className,
}: BulkBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        "sticky bottom-4 z-20 flex flex-col gap-3 rounded-[var(--radius-xl)] border border-primary/35 bg-popover/95 p-3 shadow-panel backdrop-blur sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <p className="font-ui text-sm font-semibold">{selectedCount} selected</p>
        {summary ? <div className="mt-1 text-sm text-muted-foreground">{summary}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {secondaryAction}
        {primaryAction}
      </div>
    </div>
  );
}
