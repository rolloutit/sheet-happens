import { cn } from "@/src/lib/utils";
import type { StatusPillProps, TimesheetStatus } from "./StatusPill.types";
import { statusPillVariants, statusTone } from "./StatusPill.variants";

const statusLabels: Record<TimesheetStatus, string> = {
  not_created: "Not created",
  submitted: "Submitted",
  rejected: "Rejected",
  approved: "Approved",
  invoiced: "Invoiced",
  invoice_rejected: "Invoice rejected",
  accepted: "Accepted",
  paid: "Paid",
  missing: "Missing",
};

export function StatusPill({ status, label, density, className }: StatusPillProps) {
  const tone = statusTone[status];

  return (
    <span className={cn(statusPillVariants({ tone, density }), className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label ?? statusLabels[status]}
    </span>
  );
}
