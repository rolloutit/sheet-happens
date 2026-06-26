"use client";

import { useState } from "react";

import { DataTable } from "@/src/components/ui/Table";
import { cn } from "@/src/lib/utils";
import { DocumentPreview } from "../DocumentPreview";
import { ReportChartCard } from "../ReportChartCard";
import { ReportExportDialog } from "../ReportExportDialog";
import { ReportFilterBar } from "../ReportFilterBar";
import { ReportStatTile } from "../ReportStatTile";
import type { ReportTableRow, ReportsProps } from "./Reports.types";

const defaultRows = [
  { id: "1", project: "Apollo", user: "Lena Kovacs", hours: 112, amount: "EUR 7,280" },
  { id: "2", project: "Helix", user: "Mark Chen", hours: 48, amount: "EUR 3,120" },
] satisfies ReportTableRow[];

const defaultStats = [
  { label: "Hours", value: "418.5" },
  { label: "Billable", value: "EUR 27,280" },
  { label: "Edited rows", value: "3", tone: "warning", helperText: "Needs review" },
] satisfies NonNullable<ReportsProps["stats"]>;

const defaultChartData = [
  { label: "Mon", value: 40 },
  { label: "Tue", value: 68 },
  { label: "Wed", value: 52 },
  { label: "Thu", value: 80 },
  { label: "Fri", value: 64 },
  { label: "Sat", value: 42 },
  { label: "Sun", value: 92 },
] satisfies NonNullable<ReportsProps["chartData"]>;

const defaultDistribution = [
  { id: "apollo", label: "Apollo", value: 70 },
  { id: "helix", label: "Helix", value: 55 },
  { id: "internal", label: "Internal", value: 40 },
] satisfies NonNullable<ReportsProps["distribution"]>;

const defaultDocumentRows = [
  { id: "apollo", label: "Apollo Migration", value: "112h" },
  { id: "internal-cost", label: "Internal cost", value: "EUR 7,280", internalOnly: true },
] satisfies NonNullable<ReportsProps["documentRows"]>;

export function Reports({
  mode = "cost-free",
  periodValue = "month",
  projectValue,
  view = "user",
  stats = defaultStats,
  chartData = defaultChartData,
  distribution = defaultDistribution,
  documentTitle = "June 2026",
  documentRows = defaultDocumentRows,
  rows = defaultRows,
  sort,
  onSortChange,
  onPeriodChange,
  onProjectChange,
  onViewChange,
  onExport,
  className,
}: ReportsProps) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className={cn("grid gap-4", className)}>
      <ReportFilterBar
        periodValue={periodValue}
        projectValue={projectValue}
        view={view}
        onPeriodChange={onPeriodChange}
        onProjectChange={onProjectChange}
        onViewChange={onViewChange}
        onExport={() => setExportOpen(true)}
        periodOptions={[
          { value: "month", label: "Month" },
          { value: "week", label: "Week" },
          { value: "custom", label: "Custom" },
        ]}
        projectOptions={[
          { value: "all", label: "All projects" },
          { value: "apollo", label: "Apollo" },
          { value: "helix", label: "Helix" },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, index) => (
          <ReportStatTile key={`${stat.label}-${index}`} {...stat} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <ReportChartCard data={chartData} distribution={distribution} />
        <DocumentPreview title={documentTitle} mode={mode} rows={documentRows} />
      </div>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        caption="Report rows"
        aria-label="Report rows"
        sort={sort}
        onSortChange={onSortChange}
        columns={[
          { id: "project", header: "Project", accessor: "project", sortable: true },
          { id: "user", header: "User", accessor: "user", sortable: true },
          { id: "hours", header: "Hours", accessor: "hours", align: "right", sortable: true },
          { id: "amount", header: "Amount", accessor: "amount", align: "right", sortable: true },
        ]}
      />
      <ReportExportDialog
        trigger={false}
        open={exportOpen}
        onOpenChange={setExportOpen}
        documentTitle={documentTitle}
        documentRows={documentRows}
        mode={mode}
        onExport={onExport}
      />
    </div>
  );
}
