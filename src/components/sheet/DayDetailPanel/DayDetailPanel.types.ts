import type { DurationDisplayFormat } from "@/src/lib/formatting";
import type { TimesheetStatus } from "../StatusPill";

export type DayDetailEntry = {
  id: string;
  projectName: string;
  projectColor?: string;
  durationMinutes: number;
  note?: string;
  billable?: boolean;
  status?: TimesheetStatus;
};

export type DayDetailPanelLabels = {
  title?: string;
  total?: string;
  capacity?: string;
  addEntry?: string;
  editEntry?: (entry: DayDetailEntry) => string;
  deleteEntry?: (entry: DayDetailEntry) => string;
  empty?: string;
};

export type DayDetailPanelProps = {
  dateLabel: string;
  entries: DayDetailEntry[];
  capacityMinutes?: number;
  /** Defaults to `"en"`. */
  locale?: string;
  /** Defaults to `"DECIMAL_HOURS"`. */
  durationDisplayFormat?: DurationDisplayFormat;
  labels?: DayDetailPanelLabels;
  className?: string;
  onAddEntry?: () => void;
  onEditEntry?: (entry: DayDetailEntry) => void;
  onDeleteEntry?: (entry: DayDetailEntry) => void;
};
