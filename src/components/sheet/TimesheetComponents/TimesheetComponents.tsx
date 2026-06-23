import { CalendarDays, FileCheck2, FileUp, LockKeyhole, Send } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Dropzone } from "@/src/components/ui/Dropzone";
import { LockedState } from "@/src/components/ui/LockedState";
import { cn } from "@/src/lib/utils";
import { StatusPill } from "../StatusPill";
import type { TimesheetComponentsProps } from "./TimesheetComponents.types";

const steps = ["Created", "Submitted", "Approved", "Invoiced", "Paid"];

export function TimesheetComponents({ status = "approved", className }: TimesheetComponentsProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      <Card variant="featured">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <StatusPill status={status} />
            <h2 className="mt-3 text-2xl font-semibold">June 2026 timesheet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              132.5 hours · EUR 8,945 estimated amount
            </p>
          </div>
          <Button variant="cta" icon={status === "approved" ? FileUp : Send}>
            {status === "approved" ? "Upload invoice" : "Submit timesheet"}
          </Button>
        </div>
      </Card>
      <Card variant="elevated">
        <Stepper rejected={status === "rejected" || status === "invoice_rejected"} />
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
        <BreakdownCard />
        <InvoiceSection enabled={status === "approved" || status === "invoice_rejected"} />
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

function Stepper({ rejected }: { rejected?: boolean }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => {
          const done = index < 3;
          const current = index === 3;
          return (
            <div key={step} className="grid justify-items-center gap-2 text-center">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full border font-ui text-sm font-semibold",
                  done && "border-success bg-success text-success-foreground",
                  current && "border-primary bg-primary/16 text-accent",
                  rejected && current && "border-destructive bg-destructive/14 text-destructive",
                  !done && !current && "border-border bg-secondary text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <span className="text-xs text-muted-foreground">{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BreakdownCard() {
  const rows = [
    { project: "Apollo Migration", hours: 112, rate: "EUR 65", amount: "EUR 7,280" },
    { project: "Helix Support", hours: 20.5, rate: "EUR 75", amount: "EUR 1,665" },
  ];
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Breakdown</CardTitle>
        <Badge tone="info">Mixed rates</Badge>
      </CardHeader>
      <CardContent>
        {rows.map((row) => (
          <div
            key={row.project}
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

function InvoiceSection({ enabled }: { enabled: boolean }) {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Invoice</CardTitle>
        <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Enabled" : "Locked"}</Badge>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <Dropzone
            label="Upload invoice"
            description="PDF, PNG, or JPG. Multiple invoice files are supported."
            files={[{ id: "1", name: "invoice-june.pdf", sizeLabel: "248 KB", status: "done" }]}
          />
        ) : (
          <LockedState
            title="Approval required"
            reason="Invoice upload unlocks after admin approval."
          />
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileCheck2 className="size-4" aria-hidden="true" />
          Signed link preview loads on demand.
        </div>
      </CardContent>
    </Card>
  );
}

export function MonthRow() {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4">
      <span className="grid size-12 place-items-center rounded-[var(--radius-md)] bg-primary/16 text-accent">
        <CalendarDays className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ui text-sm font-semibold">June 2026</p>
        <p className="text-sm text-muted-foreground">132.5h · EUR 8,945</p>
      </div>
      <StatusPill status="submitted" />
    </div>
  );
}
