import { Download, ExternalLink, FileText, Minus, Plus } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { EmptyState } from "../EmptyState";
import type { PdfViewerProps } from "./PdfViewer.types";

export function PdfViewer({
  title,
  src,
  state = src ? "ready" : "empty",
  page = 1,
  totalPages,
  scale = 100,
  labels,
  className,
  onPreviousPage,
  onNextPage,
  onZoomOut,
  onZoomIn,
  onDownload,
  onOpenExternal,
}: PdfViewerProps) {
  const canGoPrevious = page > 1;
  const canGoNext = typeof totalPages === "number" ? page < totalPages : true;

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Page {page}
            {totalPages ? ` of ${totalPages}` : ""} · {scale}%
          </p>
        </div>
        <Badge tone={state === "ready" ? "success" : state === "error" ? "danger" : "neutral"}>
          {state}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="soft"
            size="sm"
            disabled={!canGoPrevious}
            onClick={onPreviousPage}
          >
            {labels?.previousPage ?? "Previous"}
          </Button>
          <Button type="button" variant="soft" size="sm" disabled={!canGoNext} onClick={onNextPage}>
            {labels?.nextPage ?? "Next"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            icon={Minus}
            aria-label={labels?.zoomOut ?? "Zoom out"}
            onClick={onZoomOut}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            icon={Plus}
            aria-label={labels?.zoomIn ?? "Zoom in"}
            onClick={onZoomIn}
          />
          {onDownload ? (
            <Button type="button" variant="soft" size="sm" icon={Download} onClick={onDownload}>
              {labels?.download ?? "Download"}
            </Button>
          ) : null}
          {onOpenExternal ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={ExternalLink}
              onClick={onOpenExternal}
            >
              {labels?.openExternal ?? "Open"}
            </Button>
          ) : null}
        </div>
        <div className="min-h-[28rem] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-secondary">
          {state === "loading" ? (
            <div className="grid h-[28rem] place-items-center">
              <div className="grid gap-3 text-center text-sm text-muted-foreground">
                <span className="mx-auto size-10 animate-pulse rounded-full bg-muted" />
                {labels?.loading ?? "Loading PDF preview..."}
              </div>
            </div>
          ) : null}
          {state === "error" ? (
            <div className="grid h-[28rem] place-items-center p-6">
              <EmptyState
                icon={FileText}
                title={labels?.errorTitle ?? "PDF preview failed"}
                body={labels?.errorBody ?? "The document can still be downloaded or opened."}
              />
            </div>
          ) : null}
          {state === "empty" ? (
            <div className="grid h-[28rem] place-items-center p-6">
              <EmptyState
                icon={FileText}
                title={labels?.emptyTitle ?? "No PDF selected"}
                body={labels?.emptyBody ?? "Select a document to preview it here."}
              />
            </div>
          ) : null}
          {state === "ready" && src ? (
            <iframe
              src={src}
              title={title}
              className="h-[28rem] w-full bg-white"
              aria-label={`${title} PDF preview`}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
