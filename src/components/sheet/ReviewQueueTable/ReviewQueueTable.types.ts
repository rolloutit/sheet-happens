import type { TableSort } from "@/src/components/ui/Table";
import type { TimesheetStatus } from "../StatusPill";

export type ReviewQueueRow = {
  id: string;
  person: string;
  period: string;
  project: string;
  status: TimesheetStatus;
  amount: string;
  disabled?: boolean;
};

export type ReviewQueueTableLabels = {
  selectAll?: string;
  selectRow?: (row: ReviewQueueRow) => string;
  openRow?: (row: ReviewQueueRow) => string;
  empty?: string;
};

export type ReviewQueueTableProps = {
  rows: ReviewQueueRow[];
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onRowOpen?: (row: ReviewQueueRow) => void;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  loading?: boolean;
  labels?: ReviewQueueTableLabels;
  className?: string;
};
