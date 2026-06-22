export const timesheetStatuses = [
  "not_created",
  "submitted",
  "rejected",
  "approved",
  "invoiced",
  "invoice_rejected",
  "accepted",
  "paid",
  "missing",
] as const;

export type TimesheetStatus = (typeof timesheetStatuses)[number];

export type StatusPillTone = "muted" | "info" | "success" | "warning" | "danger";

export type StatusPillDensity = "compact" | "comfortable";

export type StatusPillProps = {
  status: TimesheetStatus;
  label?: string;
  density?: StatusPillDensity;
  className?: string;
};
