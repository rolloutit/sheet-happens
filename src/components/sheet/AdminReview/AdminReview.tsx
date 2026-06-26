"use client";

import { Search } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Input } from "@/src/components/ui/Input";
import { Pager } from "@/src/components/ui/Pager";
import { cn } from "@/src/lib/utils";
import { RejectDialog } from "../RejectDialog";
import { ReviewActionBar } from "../ReviewActionBar";
import { ReviewDiffList } from "../ReviewDiffList";
import { ReviewQueueTable } from "../ReviewQueueTable";
import type { AdminReviewProps } from "./AdminReview.types";

const defaultRows = [
  {
    id: "1",
    person: "Lena Kovacs",
    period: "Jun 2026",
    project: "Apollo",
    status: "submitted",
    amount: "EUR 8,945",
  },
  {
    id: "2",
    person: "Mark Chen",
    period: "Jun 2026",
    project: "Helix",
    status: "missing",
    amount: "EUR 0",
    disabled: true,
  },
  {
    id: "3",
    person: "Sara Nagy",
    period: "Jun 2026",
    project: "Internal",
    status: "approved",
    amount: "EUR 6,280",
  },
] satisfies NonNullable<AdminReviewProps["rows"]>;

const defaultDiffItems = [
  { id: "hours", state: "match", label: "Hours", delta: "0.0h" },
  { id: "rate", state: "match", label: "Rate", delta: "EUR 0" },
  { id: "invoice", state: "mismatch", label: "Invoice total", delta: "+EUR 125" },
] satisfies NonNullable<AdminReviewProps["diffItems"]>;

const defaultDiffTotals = [
  { id: "timesheet", label: "Timesheet total", value: "EUR 8,945", tone: "neutral" },
  { id: "invoice", label: "Invoice total", value: "EUR 9,070", tone: "warning" },
] satisfies NonNullable<AdminReviewProps["diffTotals"]>;

export function AdminReview({
  rows = defaultRows,
  selectedIds = ["1", "3"],
  selectedCount,
  onSelectedIdsChange,
  onRowOpen,
  sort,
  onSortChange,
  page = 1,
  totalPages = 4,
  totalItems = 48,
  onPageChange,
  diffItems = defaultDiffItems,
  diffTotals = defaultDiffTotals,
  diffFooter,
  onApproveSelected,
  onClearSelection,
  onRejectSelected,
  onRejectInvoice,
  className,
}: AdminReviewProps) {
  const resolvedSelectedCount = selectedCount ?? selectedIds.length;

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
      <ReviewQueueTable
        rows={rows}
        selectedIds={selectedIds}
        onSelectedIdsChange={onSelectedIdsChange}
        onRowOpen={onRowOpen}
        sort={sort}
        onSortChange={onSortChange}
      />
      <ReviewActionBar
        selectedCount={resolvedSelectedCount}
        onClear={onClearSelection}
        onApprove={onApproveSelected}
        rejectAction={
          <RejectDialog
            trigger={
              <Button type="button" variant="danger">
                Bulk reject
              </Button>
            }
            title="Reject selected submissions?"
            confirmLabel="Reject selected"
            onReject={onRejectSelected}
          />
        }
      />
      <Pager
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
      <ReviewDiffList
        items={diffItems}
        totals={diffTotals}
        footer={
          diffFooter ?? (
            <RejectDialog
              trigger={
                <Button type="button" variant="danger" size="sm">
                  Reject invoice
                </Button>
              }
              onReject={onRejectInvoice}
            />
          )
        }
      />
    </div>
  );
}
