import { FileCheck2 } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Dropzone } from "@/src/components/ui/Dropzone";
import { LockedState } from "@/src/components/ui/LockedState";
import type { InvoiceUploadPanelProps } from "./InvoiceUploadPanel.types";

export function InvoiceUploadPanel({
  title = "Invoice",
  enabled = false,
  enabledLabel = "Enabled",
  lockedLabel = "Locked",
  lockedTitle = "Approval required",
  lockedReason = "Invoice upload unlocks after admin approval.",
  description = "PDF, PNG, or JPG. Multiple invoice files are supported.",
  files,
  onFilesSelected,
  previewHint = "Signed link preview loads on demand.",
  className,
}: InvoiceUploadPanelProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge tone={enabled ? "success" : "neutral"}>{enabled ? enabledLabel : lockedLabel}</Badge>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <Dropzone
            label="Upload invoice"
            description={description}
            files={files}
            accept="application/pdf,image/png,image/jpeg"
            multiple
            onFilesSelected={onFilesSelected}
          />
        ) : (
          <LockedState title={lockedTitle} reason={lockedReason} />
        )}
        {previewHint ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCheck2 className="size-4" aria-hidden="true" />
            {previewHint}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
