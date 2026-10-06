import type { ReactNode } from "react";

export type TableDensity = "compact" | "comfortable";
export type TableSortDirection = "ascending" | "descending";
export type TableSort = {
  columnId: string;
  direction: TableSortDirection;
};
export type TableDisplayMode = "table" | "cards" | "responsive";

export type TableColumn<T extends Record<string, unknown>> = {
  id: string;
  header: ReactNode;
  accessor?: keyof T;
  cell?: (row: T) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  sortLabel?: string;
  /**
   * Label for this column in card mode. Defaults to `header`; pass `null` to drop the label and
   * let the value use the card's full width — what an identity cell (avatar, name, email) wants,
   * since a "Name" label beside a name is noise that costs the value a third of a phone screen.
   */
  mobileLabel?: ReactNode | null;
};

export type DataTableProps<T extends Record<string, unknown>> = {
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  caption?: ReactNode;
  "aria-label"?: string;
  empty?: ReactNode;
  selectedRowKeys?: string[];
  onRowClick?: (row: T) => void;
  rowActionLabel?: (row: T, index: number) => string;
  rowActions?: (row: T, index: number) => ReactNode;
  rowActionsHeader?: ReactNode;
  rowActionsLabel?: string;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  defaultSortDirection?: TableSortDirection;
  displayMode?: TableDisplayMode;
  density?: TableDensity;
  loading?: boolean;
  loadingRows?: number;
  className?: string;
};
