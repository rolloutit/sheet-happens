"use client";

import { Upload } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Dropzone } from "@/src/components/ui/Dropzone";
import type { PayslipUploadPanelProps } from "./PayslipUploadPanel.types";

export function PayslipUploadPanel({
  title = "Upload sheet",
  description = "Select employee and month before upload.",
  selectedEmployee = "Lena Kovacs",
  selectedMonth = "June 2026",
  files,
  disabled,
  uploadLabel = "Upload",
  onFilesSelected,
  onUpload,
  className,
}: PayslipUploadPanelProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {onUpload ? (
          <Button type="button" variant="cta" icon={Upload} disabled={disabled} onClick={onUpload}>
            {uploadLabel}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 rounded-[var(--radius-lg)] bg-secondary p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Employee</span>
            <span className="font-ui font-semibold">{selectedEmployee}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Month</span>
            <span className="font-ui font-semibold">{selectedMonth}</span>
          </div>
        </div>
        <Dropzone
          label="Upload payslip PDF"
          description={description}
          files={files}
          accept="application/pdf"
          disabled={disabled}
          onFilesSelected={onFilesSelected}
        />
      </CardContent>
    </Card>
  );
}
