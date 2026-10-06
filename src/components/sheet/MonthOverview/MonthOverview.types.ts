import type { ReactNode } from "react";

import type { DurationDisplayFormat } from "@/src/lib/formatting";
import type { DeclaredHoursProof, DeclaredHoursRowLabels } from "../DeclaredHoursRow";

/** One project's month: everything L4 shows about it, and nothing finer. */
export type MonthOverviewProject = {
  projectId: string;
  name: string;
  color: string;
  /** Minutes tracked against the project inside the month. `0` for a project with nothing logged. */
  minutes: number;
};

/** A declared project's month, as the band renders it. `minutes` is `null` before anything is declared. */
export type MonthOverviewDeclaredProject = {
  projectId: string;
  name: string;
  color: string;
  minutes: number | null;
  note: string;
  proof: DeclaredHoursProof | null;
  /** The implausible-figure warning, already worded, or `null`. */
  warning?: string | null;
  /** A failed save or upload for this row, already worded. */
  error?: string | null;
  saving?: boolean;
  uploading?: boolean;
  savedAt?: number | null;
};

export type MonthOverviewLabels = {
  /** The tracked band's heading — the hours that live in Sheet Happens rather than elsewhere. */
  trackedHeading: string;
  /** The declared band's heading — hours that came from another company's system. */
  declaredHeading: string;
  /** A row's accessible name. The row is the L4 → L3 zoom, so it says where pressing it lands. */
  zoomToProject: (project: MonthOverviewProject) => string;
  emptyTitle: string;
  emptyDescription: string;
  declared: DeclaredHoursRowLabels;
};

export type MonthOverviewProps = {
  /** The tracked band, ordered by the caller. A project with no hours still earns a row. */
  projects: MonthOverviewProject[];
  /**
   * The declared band, ordered by the caller. Empty for a member with no declared assignments,
   * which is the shape the level shipped with before declarations existed.
   */
  declared?: MonthOverviewDeclaredProject[];
  /**
   * Whether the whole month is locked by a submitted timesheet, which makes every declared row
   * read-only. A member-and-month fact the `/time` page already holds in `week.lockedMonthStarts`,
   * so it arrives as a flag rather than being re-derived per row.
   */
  monthLocked?: boolean;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  labels: MonthOverviewLabels;
  /** A pending mutation, which disables every affordance that would start another. */
  disabled?: boolean;
  /**
   * Whether rows animate in when they mount.
   *
   * The same rule as `animateEntries` on the day and week levels, and off by default for the same
   * reasons: §9's `initial={false}` keeps a page load still, and the visual baselines want the
   * settled state rather than a frame of a transition.
   */
  animateRows?: boolean;
  /**
   * The heat navigator, rendered above the bands (§4.4 of `docs/time-view-redesign.md`). A slot
   * rather than a dependency: the navigator needs the per-day totals and the selected week, which
   * the screen owns, and the bands know nothing about days.
   */
  navigator?: ReactNode;
  className?: string;
  onZoomToProject: (project: MonthOverviewProject) => void;
  onSaveDeclaration?: (input: { projectId: string; minutes: number; note: string }) => void;
  onUploadProof?: (input: { projectId: string; file: File }) => void;
};
