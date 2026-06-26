"use client";

import { CalendarDays } from "lucide-react";

import { ListRow } from "@/src/components/ui/ListRow";
import { cn } from "@/src/lib/utils";
import { StatusPill } from "../StatusPill";
import type { MonthRowProps } from "./MonthRow.types";

export function MonthRow({ month, meta, status, actionLabel, onClick, className }: MonthRowProps) {
  return (
    <ListRow
      className={cn("p-4", className)}
      leading={
        <span className="grid size-12 place-items-center rounded-[var(--radius-md)] bg-primary/16 text-accent">
          <CalendarDays className="size-5" aria-hidden="true" />
        </span>
      }
      title={month}
      meta={meta}
      trailing={<StatusPill status={status} />}
      actionLabel={actionLabel}
      onClick={onClick}
    />
  );
}
