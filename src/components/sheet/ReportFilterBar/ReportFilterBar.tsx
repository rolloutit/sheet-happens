"use client";

import { Download } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Select } from "@/src/components/ui/Select";
import { cn } from "@/src/lib/utils";
import type { ReportFilterBarProps, ReportView } from "./ReportFilterBar.types";

export function ReportFilterBar({
  periodValue,
  projectValue,
  view = "user",
  periodOptions,
  projectOptions,
  onPeriodChange,
  onProjectChange,
  onViewChange,
  onExport,
  exportLabel = "Export",
  className,
}: ReportFilterBarProps) {
  return (
    <Card variant="elevated" className={className}>
      <div className={cn("grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-center")}>
        <Select
          aria-label="Period"
          value={periodValue}
          onValueChange={onPeriodChange}
          options={periodOptions}
        />
        <Select
          aria-label="Project"
          value={projectValue}
          defaultValue={projectValue}
          placeholder="All projects"
          onValueChange={onProjectChange}
          options={projectOptions}
        />
        <SegmentedControl
          label="Report view"
          value={view}
          onValueChange={(nextView) => onViewChange?.(nextView as ReportView)}
          items={[
            { value: "user", label: "User" },
            { value: "project", label: "Project" },
          ]}
        />
        <Button type="button" variant="cta" icon={Download} onClick={onExport}>
          {exportLabel}
        </Button>
      </div>
    </Card>
  );
}
