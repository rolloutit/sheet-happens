"use client";

import { Download } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/Dialog";
import { formatHoursWithUnit } from "@/src/lib/formatting";
import type { TimeBreakdownDialogProps, TimeBreakdownRowTone } from "./TimeBreakdownDialog.types";

const toneMap: Record<TimeBreakdownRowTone, "neutral" | "warning" | "success"> = {
  default: "neutral",
  warning: "warning",
  success: "success",
};

export function TimeBreakdownDialog({
  rows,
  trigger,
  open,
  defaultOpen,
  totalMinutes,
  totalAmount,
  locale = "en",
  durationDisplayFormat = "DECIMAL_HOURS",
  labels,
  onOpenChange,
  onExport,
}: TimeBreakdownDialogProps) {
  const resolvedTotalMinutes =
    totalMinutes ?? rows.reduce((sum, row) => sum + row.durationMinutes, 0);

  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="soft">
            {labels?.trigger ?? "View breakdown"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{labels?.title ?? "Time breakdown"}</DialogTitle>
          <DialogDescription>
            {labels?.description ?? "Review billable and non-billable time before submission."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-2 rounded-[var(--radius-lg)] border border-border bg-card p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-ui text-sm font-semibold">{row.label}</p>
                  <Badge tone={toneMap[row.tone ?? "default"]}>{row.tone ?? "default"}</Badge>
                </div>
                {row.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
                ) : null}
              </div>
              <span className="font-ui text-sm font-semibold">
                {labels?.hours ?? "Hours"}:{" "}
                {formatHoursWithUnit(row.durationMinutes, locale, durationDisplayFormat)}
              </span>
              {row.amount ? (
                <span className="font-ui text-sm font-semibold">
                  {labels?.amount ?? "Amount"}: {row.amount}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="grid gap-2 rounded-[var(--radius-lg)] bg-secondary p-4 sm:grid-cols-2">
          <p className="font-ui text-sm font-semibold">
            {labels?.hours ?? "Hours"}:{" "}
            {formatHoursWithUnit(resolvedTotalMinutes, locale, durationDisplayFormat)}
          </p>
          {totalAmount ? (
            <p className="font-ui text-sm font-semibold">
              {labels?.amount ?? "Amount"}: {totalAmount}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {labels?.close ?? "Close"}
            </Button>
          </DialogClose>
          {onExport ? (
            <Button type="button" variant="cta" icon={Download} onClick={onExport}>
              {labels?.export ?? "Export"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
