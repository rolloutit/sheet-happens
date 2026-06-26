import type { HTMLAttributes, ReactNode } from "react";

export type PagerLabels = {
  navigation?: string;
  previous?: string;
  next?: string;
  previousPage?: (page: number) => string;
  nextPage?: (page: number) => string;
  page?: (page: number) => string;
  currentPage?: (page: number) => string;
  summary?: (page: number, totalPages: number, totalItems?: number) => ReactNode;
};

export type PagerProps = Omit<HTMLAttributes<HTMLElement>, "onChange"> & {
  page: number;
  totalPages: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  labels?: PagerLabels;
  showPageNumbers?: boolean;
  siblingCount?: number;
};
