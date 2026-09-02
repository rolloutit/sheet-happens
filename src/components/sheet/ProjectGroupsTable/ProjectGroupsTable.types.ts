import type { ReactNode } from "react";

import type { TableSort } from "@/src/components/ui/Table";
import type { ProjectColorToken } from "@/src/lib/project-colors";

export type ProjectGroupTableProjectRef = {
  id: string;
  name: string;
  colorToken: ProjectColorToken;
};

export type ProjectGroupTableRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  projectCount: number;
  /** Ordered by name; the table shows a preview of the first few and folds the rest into "+N". */
  projects: ProjectGroupTableProjectRef[];
  /** Pre-formatted with `src/lib/formatting/dates.ts` — this component never calls `Intl` itself. */
  updatedAtLabel: string;
};

export type ProjectGroupsTableLabels = {
  caption?: string;
  ariaLabel?: string;
  /** Accessible name for the row's own "open" button, e.g. `Open {name}`. */
  openGroup: (row: ProjectGroupTableRow) => string;
  rowActionsLabel?: string;
  columns: {
    group: string;
    projects: string;
    state: string;
    updated: string;
  };
  states: {
    active: string;
    inactive: string;
  };
  noProjects: string;
  projectCount: (count: number) => string;
  moreProjects: (count: number) => string;
  empty?: ReactNode;
};

export type ProjectGroupsTableProps = {
  rows: ProjectGroupTableRow[];
  onOpenGroup: (row: ProjectGroupTableRow) => void;
  rowActions?: (row: ProjectGroupTableRow) => ReactNode;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  loading?: boolean;
  labels: ProjectGroupsTableLabels;
  className?: string;
};
