import type { DurationDisplayFormat } from "@/src/lib/formatting";

export type TimeGridCellState =
  "empty" | "filled" | "editing" | "today" | "future" | "warning" | "locked";

export type TimeGridDayState = "normal" | "today" | "future";

export type TimeGridDay = {
  id: string;
  label: string;
  date: string;
  isoDate?: string;
  state?: TimeGridDayState;
};

export type TimeGridCellValue = {
  durationMinutes?: number;
  state?: TimeGridCellState;
  note?: string;
  warning?: string;
  locked?: boolean;
};

export type TimeGridProject = {
  id: string;
  name: string;
  color: string;
  inactive?: boolean;
  billingLabel?: string;
  durationMinutes?: number[];
  cells?: Record<string, TimeGridCellValue>;
};

export type TimeGridSelectedCell = {
  projectId: string;
  dayId: string;
};

export type TimeGridCellContext = {
  project: TimeGridProject;
  day: TimeGridDay;
  dayIndex: number;
  value: TimeGridCellValue;
};

export type TimeGridTimerState = {
  projectId?: string;
  description?: string;
  elapsedLabel?: string;
  running?: boolean;
};

export type WeeklyTimeGridLabels = {
  eyebrow?: string;
  title?: string;
  description?: string;
  previousWeek?: string;
  nextWeek?: string;
  today?: string;
  save?: string;
  addProject?: string;
  copyPreviousDay?: string;
  lockedTitle?: string;
  lockedReason?: string;
  projectColumn?: string;
  totalColumn?: string;
  dailyTotal?: string;
  gridTitle?: string;
  inactiveRow?: string;
  /** e.g. `(hours) => \`${hours} óra\`` — wraps the formatted week total. */
  totalHoursBadge?: (formattedHours: string) => string;
  /** e.g. `(hours) => \`${hours} óra jóváhagyható\`` — wraps the approvable-hours cap. */
  approvableHoursBadge?: (formattedHours: string) => string;
  missingDescriptionBadge?: (count: number) => string;
  /** e.g. `(hours) => \`${hours} óra\`` — the mobile per-day summary caption. */
  dailyTotalCaption?: (formattedHours: string) => string;
};

export type WeeklyTimeGridProps = {
  projects?: TimeGridProject[];
  days?: TimeGridDay[];
  weekLabel?: string;
  monthLabel?: string;
  selectedProjectId?: string;
  editingCell?: TimeGridSelectedCell | null;
  defaultEditingCell?: TimeGridSelectedCell | null;
  locked?: boolean;
  showTimer?: boolean;
  timer?: TimeGridTimerState;
  /** Defaults to `"hu"`, matching this component's own Hungarian demo defaults. */
  locale?: string;
  /** Defaults to `"DECIMAL_HOURS"`. */
  durationDisplayFormat?: DurationDisplayFormat;
  labels?: WeeklyTimeGridLabels;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  onToday?: () => void;
  onSave?: () => void;
  onAddProject?: () => void;
  onCopyPreviousDay?: () => void;
  onProjectSelect?: (project: TimeGridProject) => void;
  onCellFocus?: (context: TimeGridCellContext) => void;
  onCellEditStart?: (context: TimeGridCellContext) => void;
  onCellChange?: (context: TimeGridCellContext, durationMinutes: number) => void;
  className?: string;
};
