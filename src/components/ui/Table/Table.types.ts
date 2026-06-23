import type { ReactNode } from "react";

export type TableColumn<T extends Record<string, unknown>> = {
  id: string;
  header: ReactNode;
  accessor?: keyof T;
  cell?: (row: T) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
};

export type DataTableProps<T extends Record<string, unknown>> = {
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  selectedRowKeys?: string[];
  onRowClick?: (row: T) => void;
};
