import type { DurationDisplayFormat } from "@/src/lib/formatting";

/** One project's month: everything L4 shows about it, and nothing finer. */
export type MonthOverviewProject = {
  projectId: string;
  name: string;
  color: string;
  /** Minutes tracked against the project inside the month. `0` for a project with nothing logged. */
  minutes: number;
};

export type MonthOverviewLabels = {
  /** The tracked band's heading — the hours that live in Sheet Happens rather than elsewhere. */
  trackedHeading: string;
  /** A row's accessible name. The row is the L4 → L3 zoom, so it says where pressing it lands. */
  zoomToProject: (project: MonthOverviewProject) => string;
  emptyTitle: string;
  emptyDescription: string;
};

export type MonthOverviewProps = {
  /** The tracked band, ordered by the caller. A project with no hours still earns a row. */
  projects: MonthOverviewProject[];
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
  className?: string;
  onZoomToProject: (project: MonthOverviewProject) => void;
};
