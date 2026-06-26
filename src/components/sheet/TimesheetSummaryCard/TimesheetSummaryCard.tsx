"use client";

import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { cn } from "@/src/lib/utils";
import { StatusPill } from "../StatusPill";
import type { TimesheetSummaryCardProps } from "./TimesheetSummaryCard.types";

export function TimesheetSummaryCard({
  title,
  status,
  meta,
  action,
  className,
}: TimesheetSummaryCardProps) {
  return (
    <Card variant="featured" className={className}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <StatusPill status={status} />
          <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
          {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
        </div>
        {action ? (
          <Button
            type="button"
            variant={action.variant ?? "cta"}
            icon={action.icon}
            disabled={action.disabled}
            onClick={action.onClick}
            className={cn(action.disabled && "opacity-60")}
          >
            {action.label}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
