import { Download, FileSpreadsheet } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { DataTable } from "@/src/components/ui/Table";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Select } from "@/src/components/ui/Select";
import { cn } from "@/src/lib/utils";
import type { ReportsProps } from "./Reports.types";

const reportRows = [
  { id: "1", project: "Apollo", user: "Lena Kovacs", hours: 112, amount: "EUR 7,280" },
  { id: "2", project: "Helix", user: "Mark Chen", hours: 48, amount: "EUR 3,120" },
];

export function Reports({ mode = "cost-free", className }: ReportsProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      <Card variant="elevated">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
          <Select
            aria-label="Period"
            defaultValue="month"
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <Select
            aria-label="Project"
            placeholder="All projects"
            options={[{ value: "apollo", label: "Apollo" }]}
          />
          <SegmentedControl
            label="Report view"
            value="user"
            items={[
              { value: "user", label: "User" },
              { value: "project", label: "Project" },
            ]}
          />
          <Button variant="cta" icon={Download}>
            Export
          </Button>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <ReportStat label="Hours" value="418.5" />
        <ReportStat label="Billable" value="EUR 27,280" />
        <ReportStat label="Edited rows" value="3" warning />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Charts />
        <ExportPreview mode={mode} />
      </div>
      <DataTable
        rows={reportRows}
        getRowKey={(row) => row.id}
        columns={[
          { id: "project", header: "Project", accessor: "project" },
          { id: "user", header: "User", accessor: "user" },
          { id: "hours", header: "Hours", accessor: "hours", align: "right" },
          { id: "amount", header: "Amount", accessor: "amount", align: "right" },
        ]}
      />
    </div>
  );
}

function ReportStat({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <Card variant={warning ? "warning" : "elevated"}>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <FileSpreadsheet className="size-5 text-accent" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">
          {warning ? "Needs review" : "Current filter"}
        </p>
      </CardContent>
    </Card>
  );
}

function Charts() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Charts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-end gap-3">
          {[40, 68, 52, 80, 64, 42, 92].map((height, index) => (
            <span
              key={index}
              className="flex-1 rounded-t bg-primary/55"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="grid gap-2">
          {["Apollo", "Helix", "Internal"].map((label, index) => (
            <div key={label} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-sm">
              <span>{label}</span>
              <span className="h-2 rounded-full bg-secondary">
                <span
                  className="block h-2 rounded-full bg-cta"
                  style={{ width: `${70 - index * 15}%` }}
                />
              </span>
              <span className="font-ui font-semibold">{70 - index * 15}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ExportPreview({ mode }: { mode: "cost-free" | "internal" }) {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Export document</CardTitle>
        <Badge tone={mode === "internal" ? "warning" : "info"}>{mode}</Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded bg-white p-5 text-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">Sheet Happens report</p>
          <h3 className="mt-2 text-xl font-semibold">June 2026</h3>
          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between border-b border-slate-200 py-2">
              <span>Apollo Migration</span>
              <span>112h</span>
            </div>
            {mode === "internal" ? (
              <div className="flex justify-between border-b border-slate-200 py-2">
                <span>Internal cost</span>
                <span>EUR 7,280</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
