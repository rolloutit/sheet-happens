import { FileUp, LockKeyhole, Send } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { LockedState } from "@/src/components/ui/LockedState";
import { cn } from "@/src/lib/utils";
import { InvoiceUploadPanel } from "../InvoiceUploadPanel";
import { TimesheetStepper } from "../TimesheetStepper";
import { TimesheetSummaryCard } from "../TimesheetSummaryCard";
import type { TimesheetBreakdownRow, TimesheetComponentsProps } from "./TimesheetComponents.types";

const defaultBreakdownRows: TimesheetBreakdownRow[] = [
  { id: "apollo", project: "Apollo Migration", hours: 112, rate: "EUR 65", amount: "EUR 7,280" },
  { id: "helix", project: "Helix Support", hours: 20.5, rate: "EUR 75", amount: "EUR 1,665" },
];

const defaultInvoiceFiles = [
  { id: "1", name: "invoice-june.pdf", sizeLabel: "248 KB", status: "done" },
] satisfies NonNullable<TimesheetComponentsProps["invoiceFiles"]>;

export function TimesheetComponents({
  status = "approved",
  title = "June 2026 timesheet",
  meta = "132.5 hours · EUR 8,945 estimated amount",
  action,
  breakdownRows = defaultBreakdownRows,
  invoiceFiles = defaultInvoiceFiles,
  onInvoiceFilesSelected,
  className,
}: TimesheetComponentsProps) {
  const invoiceEnabled = status === "approved" || status === "invoice_rejected";
  const summaryAction =
    action ??
    ({
      label: status === "approved" ? "Upload invoice" : "Submit timesheet",
      icon: status === "approved" ? FileUp : Send,
      variant: "cta",
    } satisfies NonNullable<TimesheetComponentsProps["action"]>);

  return (
    <div className={cn("grid gap-4", className)}>
      <TimesheetSummaryCard title={title} status={status} meta={meta} action={summaryAction} />
      <Card variant="elevated">
        <TimesheetStepper status={status} />
      </Card>
      {status === "rejected" || status === "invoice_rejected" ? (
        <Card variant="warning">
          <p className="font-ui text-sm font-semibold">Rejected by admin</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Missing descriptions on two project entries.
          </p>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <BreakdownCard rows={breakdownRows} />
        <InvoiceUploadPanel
          enabled={invoiceEnabled}
          files={invoiceEnabled ? invoiceFiles : []}
          onFilesSelected={onInvoiceFilesSelected}
        />
      </div>
      {status === "paid" ? (
        <LockedState
          title="Paid timesheet"
          reason="Paid timesheets are immutable. Contact finance if a correction is required."
          action={<LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />}
        />
      ) : null}
    </div>
  );
}

function BreakdownCard({ rows }: { rows: TimesheetBreakdownRow[] }) {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Breakdown</CardTitle>
        <Badge tone="info">Mixed rates</Badge>
      </CardHeader>
      <CardContent>
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_auto] gap-3 rounded-[var(--radius-md)] bg-secondary p-3"
          >
            <div>
              <p className="font-ui text-sm font-semibold">{row.project}</p>
              <p className="text-xs text-muted-foreground">
                {row.hours}h at {row.rate}
              </p>
            </div>
            <p className="font-ui text-sm font-semibold">{row.amount}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
