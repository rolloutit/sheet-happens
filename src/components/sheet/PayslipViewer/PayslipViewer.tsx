"use client";

import { Download, ExternalLink, FileWarning } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Skeleton } from "@/src/components/ui/Skeleton";
import type { PayslipViewerProps, PayslipViewerState } from "./PayslipViewer.types";

const stateTone: Record<PayslipViewerState, "neutral" | "info" | "success" | "warning" | "danger"> =
  {
    loading: "info",
    ready: "success",
    error: "danger",
    empty: "neutral",
  };

const stateLabel: Record<PayslipViewerState, string> = {
  loading: "Signed link loading",
  ready: "Ready",
  error: "Preview failed",
  empty: "No document",
};

export function PayslipViewer({
  title = "Viewer",
  fileName = "payslip-june.pdf",
  state = "loading",
  meta = "Signed link preview loads on demand.",
  error = "The signed preview link could not be loaded.",
  openLabel = "Open preview",
  downloadLabel = "Download",
  onOpen,
  onDownload,
  className,
}: PayslipViewerProps) {
  const ready = state === "ready";

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge tone={stateTone[state]}>{stateLabel[state]}</Badge>
      </CardHeader>
      <CardContent>
        {state === "loading" ? <Skeleton variant="document" /> : null}
        {ready ? (
          <div className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-secondary p-4">
            <div>
              <p className="font-ui text-sm font-semibold">{fileName}</p>
              {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {onOpen ? (
                <Button type="button" variant="soft" icon={ExternalLink} onClick={onOpen}>
                  {openLabel}
                </Button>
              ) : null}
              {onDownload ? (
                <Button type="button" variant="cta" icon={Download} onClick={onDownload}>
                  {downloadLabel}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {state === "error" ? (
          <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">
            <FileWarning className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
        {state === "empty" ? (
          <div className="rounded-[var(--radius-lg)] bg-secondary p-4 text-sm text-muted-foreground">
            No payslip has been selected.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
