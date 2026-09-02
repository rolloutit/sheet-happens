import type { ProjectColorToken } from "@/src/lib/project-colors";

export type ProjectPickerStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type ProjectPickerOption = {
  id: string;
  name: string;
  slug: string;
  colorToken: ProjectColorToken;
  isInternal: boolean;
  status: ProjectPickerStatus;
};

export type ProjectPickerFilter = "all" | "inGroup" | "available";

export type ProjectPickerLabels = {
  filterGroupLabel: string;
  filters: {
    all: string;
    inGroup: string;
    available: string;
  };
  searchLabel: string;
  searchPlaceholder: string;
  noMatches: string;
  noneAvailable: string;
  /** Accessible name for one row's checkbox — the row itself carries no visible label element. */
  toggleLabel: (project: ProjectPickerOption) => string;
  badges: {
    internal: string;
    inactive: string;
    archived: string;
  };
};

export type ProjectPickerProps = {
  projects: ProjectPickerOption[];
  selectedIds: string[];
  /** Ids with an add/remove request in flight — disables the row and shows a spinner. */
  pendingIds?: string[];
  onToggle: (id: string, next: boolean) => void;
  filter: ProjectPickerFilter;
  onFilterChange: (filter: ProjectPickerFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  labels: ProjectPickerLabels;
  className?: string;
};
