import type { ReactNode } from "react";

export type FilterChip<Id extends string = string> = {
  /** Stable id, in practice the query-string name the chip removes. */
  id: Id;
  /** What the chip shows. A bare value is fine when `aria` names the filter. */
  label: string;
  /** Spoken form, for when the visible label is only a value — a search term, say. */
  aria?: string;
  /** Rendered before the label; a small icon standing in for a prefix that would be too long. */
  leading?: ReactNode;
};

export type FilterChipsLabels = {
  active: string;
  clear: string;
  remove: (filter: string) => string;
};

export type FilterChipsProps<Id extends string = string> = {
  chips: FilterChip<Id>[];
  labels: FilterChipsLabels;
  onRemove: (id: Id) => void;
  onClear: () => void;
  /** Right-hand meta line, e.g. "Showing 1-9 of 9". Keeps the row present with no chips. */
  summary?: ReactNode;
  className?: string;
};
