import type { TableSort } from "@/src/components/ui/Table";
import type { ReactNode } from "react";
import type { ReviewDiffItem, ReviewDiffTotal } from "../ReviewDiffList";
import type { ReviewQueueRow } from "../ReviewQueueTable";

export type AdminReviewProps = {
  rows?: ReviewQueueRow[];
  selectedIds?: string[];
  selectedCount?: number;
  onSelectedIdsChange?: (ids: string[]) => void;
  onRowOpen?: (row: ReviewQueueRow) => void;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  diffItems?: ReviewDiffItem[];
  diffTotals?: ReviewDiffTotal[];
  diffFooter?: ReactNode;
  onApproveSelected?: () => void;
  onClearSelection?: () => void;
  onRejectSelected?: (reason: string) => void;
  onRejectInvoice?: (reason: string) => void;
  className?: string;
};
