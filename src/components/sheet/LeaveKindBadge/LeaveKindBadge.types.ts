import type { HTMLAttributes } from "react";

import type { LeaveCalendarKind } from "../LeaveCalendar/LeaveCalendar.types";

export type LeaveKindBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  kind: LeaveCalendarKind;
  /** The kind's name in the reader's language; the badge never shows colour alone. */
  label: string;
  size?: "sm" | "md";
};
