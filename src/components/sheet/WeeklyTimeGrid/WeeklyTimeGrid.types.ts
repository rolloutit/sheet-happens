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
  hours?: number;
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
  hours?: number[];
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
  onCellChange?: (context: TimeGridCellContext, hours: number) => void;
  className?: string;
};
