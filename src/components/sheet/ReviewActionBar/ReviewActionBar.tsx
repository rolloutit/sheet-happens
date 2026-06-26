"use client";

import { BulkBar } from "@/src/components/ui/BulkBar";
import { Button } from "@/src/components/ui/Button";
import type { ReviewActionBarProps } from "./ReviewActionBar.types";

export function ReviewActionBar({
  selectedCount,
  summary = "Submitted rows are ready for approval.",
  rejectAction,
  onClear,
  onApprove,
  labels,
  className,
}: ReviewActionBarProps) {
  return (
    <BulkBar
      className={className}
      selectedCount={selectedCount}
      summary={summary}
      labels={{
        region: labels?.region ?? "Admin review actions",
        selected: labels?.selected,
      }}
      secondaryAction={
        <>
          {rejectAction}
          {onClear ? (
            <Button type="button" variant="ghost" onClick={onClear}>
              {labels?.clear ?? "Clear"}
            </Button>
          ) : null}
        </>
      }
      primaryAction={
        onApprove ? (
          <Button type="button" variant="cta" onClick={onApprove}>
            {labels?.approve ?? "Bulk approve"}
          </Button>
        ) : null
      }
    />
  );
}
