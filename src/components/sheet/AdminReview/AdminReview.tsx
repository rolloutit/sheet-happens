import { CheckCircle2, FileText, Search, XCircle } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { BulkBar } from "@/src/components/ui/BulkBar";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { DataTable } from "@/src/components/ui/Table";
import { Input } from "@/src/components/ui/Input";
import { Pager } from "@/src/components/ui/Pager";
import { Textarea } from "@/src/components/ui/Textarea";
import { cn } from "@/src/lib/utils";
import { StatusPill } from "../StatusPill";
import type { AdminReviewProps, DiffBadgeState } from "./AdminReview.types";

type QueueRow = {
  id: string;
  name: string;
  period: string;
  project: string;
  status: "submitted" | "approved" | "missing";
  amount: string;
};

const rows: QueueRow[] = [
  {
    id: "1",
    name: "Lena Kovacs",
    period: "Jun 2026",
    project: "Apollo",
    status: "submitted",
    amount: "EUR 8,945",
  },
  {
    id: "2",
    name: "Mark Chen",
    period: "Jun 2026",
    project: "Helix",
    status: "missing",
    amount: "EUR 0",
  },
  {
    id: "3",
    name: "Sara Nagy",
    period: "Jun 2026",
    project: "Internal",
    status: "approved",
    amount: "EUR 6,280",
  },
];

export function AdminReview({ selectedCount = 2, className }: AdminReviewProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      <Card variant="elevated">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input className="pl-9" placeholder="Search people, projects, periods" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Submitted</Badge>
            <Badge>All projects</Badge>
            <Badge>June</Badge>
          </div>
        </div>
      </Card>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        selectedRowKeys={["1", "3"]}
        columns={[
          {
            id: "select",
            header: "",
            cell: (row) => <Checkbox checked={row.id !== "2"} />,
            width: "3rem",
          },
          { id: "name", header: "Person", accessor: "name" },
          { id: "period", header: "Period", accessor: "period" },
          { id: "project", header: "Project", accessor: "project" },
          {
            id: "status",
            header: "Status",
            cell: (row) => (
              <StatusPill status={row.status === "missing" ? "missing" : row.status} />
            ),
          },
          { id: "amount", header: "Amount", accessor: "amount", align: "right" },
        ]}
      />
      <BulkBar
        selectedCount={selectedCount}
        summary="Submitted rows are ready for approval."
        secondaryAction={<Button variant="ghost">Clear</Button>}
        primaryAction={<Button variant="cta">Bulk approve</Button>}
      />
      <Pager page={1} totalPages={4} totalItems={48} />
      <ReviewDetail />
    </div>
  );
}

function ReviewDetail() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <div>
          <CardTitle>Invoice diff</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare submitted timesheet totals with uploaded invoice.
          </p>
        </div>
        <StatusPill status="invoiced" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          <DiffBadge state="match" label="Hours" delta="0.0h" />
          <DiffBadge state="match" label="Rate" delta="EUR 0" />
          <DiffBadge state="mismatch" label="Invoice total" delta="+EUR 125" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-border bg-secondary p-4">
            <p className="font-ui text-sm font-semibold">Timesheet total</p>
            <p className="mt-3 text-2xl font-semibold">EUR 8,945</p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-warning/35 bg-warning/10 p-4">
            <p className="font-ui text-sm font-semibold">Invoice total</p>
            <p className="mt-3 text-2xl font-semibold">EUR 9,070</p>
          </div>
        </div>
        <RejectDialogPreview />
      </CardContent>
    </Card>
  );
}

function DiffBadge({
  state,
  label,
  delta,
}: {
  state: DiffBadgeState;
  label: string;
  delta: string;
}) {
  const Icon = state === "match" ? CheckCircle2 : XCircle;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-lg)] border p-3",
        state === "match"
          ? "border-success/30 bg-success/10"
          : "border-destructive/35 bg-destructive/10",
      )}
    >
      <Icon
        className={cn("size-5", state === "match" ? "text-success" : "text-destructive")}
        aria-hidden="true"
      />
      <div>
        <p className="font-ui text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{delta}</p>
      </div>
    </div>
  );
}

function RejectDialogPreview() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="size-4 text-destructive" aria-hidden="true" />
        <p className="font-ui text-sm font-semibold">Reject dialog state</p>
      </div>
      <Textarea
        placeholder="Explain what needs to be corrected before resubmission."
        defaultValue=""
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
        <Button variant="danger" size="sm" disabled>
          Reject invoice
        </Button>
      </div>
    </div>
  );
}
