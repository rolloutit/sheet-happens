"use client";

import { Download, Eye, FileText } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { IconButton } from "@/src/components/ui/IconButton";
import { ListRow } from "@/src/components/ui/ListRow";
import { cn } from "@/src/lib/utils";
import { payslipStatusLabels, payslipStatusTone } from "../PayslipStatus";
import type { PayslipMonthItem, PayslipMonthListProps } from "./PayslipMonthList.types";

function canOpen(item: PayslipMonthItem) {
  return item.status === "available";
}

export function PayslipMonthList({
  items,
  selectedId,
  onPreview,
  onDownload,
  labels,
  className,
}: PayslipMonthListProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{labels?.title ?? "History"}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="grid gap-3">
            {items.map((item) => {
              const available = canOpen(item);
              return (
                <ListRow
                  key={item.id}
                  className={cn(
                    "p-4",
                    selectedId === item.id && "border-primary/50 bg-accent-soft",
                  )}
                  leading={
                    <span className="grid size-12 place-items-center rounded-[var(--radius-md)] bg-accent-soft text-accent">
                      <FileText className="size-5" aria-hidden="true" />
                    </span>
                  }
                  title={item.month}
                  meta={item.meta ?? item.fileName ?? "No document uploaded yet."}
                  trailing={
                    <div className="flex items-center gap-2">
                      <Badge tone={payslipStatusTone[item.status]}>
                        {payslipStatusLabels[item.status]}
                      </Badge>
                      {onPreview ? (
                        <IconButton
                          type="button"
                          icon={Eye}
                          label={labels?.preview?.(item) ?? `Preview ${item.month} payslip`}
                          size="sm"
                          disabled={!available}
                          onClick={(event) => {
                            event.stopPropagation();
                            onPreview(item);
                          }}
                        />
                      ) : null}
                      {onDownload ? (
                        <IconButton
                          type="button"
                          icon={Download}
                          label={labels?.download?.(item) ?? `Download ${item.month} payslip`}
                          size="sm"
                          disabled={!available}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDownload(item);
                          }}
                        />
                      ) : null}
                    </div>
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] bg-secondary p-4 text-sm text-muted-foreground">
            {labels?.empty ?? "No payslips have been published yet."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
