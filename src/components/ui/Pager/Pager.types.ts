import type { HTMLAttributes } from "react";

export type PagerProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  page: number;
  totalPages: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
};
