import { CalendarOff, Palmtree, Thermometer, type LucideIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";

import type { LeaveCalendarKind } from "../LeaveCalendar/LeaveCalendar.types";
import type { LeaveKindBadgeProps } from "./LeaveKindBadge.types";
import { leaveKindBadgeVariants } from "./LeaveKindBadge.variants";

export const leaveKindIcons: Record<LeaveCalendarKind, LucideIcon> = {
  vacation: Palmtree,
  sick: Thermometer,
  absent: CalendarOff,
};

export function LeaveKindBadge({ kind, label, size, className, ...props }: LeaveKindBadgeProps) {
  const Icon = leaveKindIcons[kind];

  return (
    <span className={cn(leaveKindBadgeVariants({ kind, size }), className)} {...props}>
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
