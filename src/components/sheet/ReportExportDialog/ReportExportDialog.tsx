"use client";

import { Download } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/Dialog";
import { DocumentPreview } from "../DocumentPreview";
import type { ReportExportDialogProps, ReportExportFormat } from "./ReportExportDialog.types";

const formatLabels: Record<ReportExportFormat, string> = {
  xlsx: "Export XLSX",
  csv: "Export CSV",
  pdf: "Export PDF",
};

export function ReportExportDialog({
  trigger,
  title = "Export report",
  description = "Choose an export format and verify the document preview before downloading.",
  documentTitle,
  documentRows,
  mode = "cost-free",
  formats = ["xlsx", "csv", "pdf"],
  onExport,
  open,
  onOpenChange,
}: ReportExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger === false ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" variant="cta" icon={Download}>
              Export
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DocumentPreview title={documentTitle} mode={mode} rows={documentRows} />
        <DialogFooter>
          {formats.map((format) => (
            <Button key={format} type="button" variant="soft" onClick={() => onExport?.(format)}>
              {formatLabels[format]}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
