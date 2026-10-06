import type { HTMLAttributes, ReactNode } from "react";

export type PagerLabels = {
  navigation?: string;
  previous?: string;
  next?: string;
  /**
   * The step controls name what they do, not where they land. Naming them after the destination
   * page made them collide with the numbered buttons, which are called exactly that — so a screen
   * reader announced two "Go to page 6" buttons, and `getByRole` matched both.
   */
  previousPage?: string;
  nextPage?: string;
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
