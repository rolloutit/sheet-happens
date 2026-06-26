import type { TimesheetStatus } from "../StatusPill";

export type DayDetailEntry = {
  id: string;
  projectName: string;
  projectColor?: string;
  hours: number;
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
  capacityHours?: number;
  labels?: DayDetailPanelLabels;
  className?: string;
  onAddEntry?: () => void;
  onEditEntry?: (entry: DayDetailEntry) => void;
  onDeleteEntry?: (entry: DayDetailEntry) => void;
};
