export type TimeGridCellState =
  | "empty"
  | "filled"
  | "editing"
  | "today"
  | "future"
  | "warning"
  | "locked";

export type TimeGridProject = {
  id: string;
  name: string;
  color: string;
  inactive?: boolean;
  hours: number[];
};

export type WeeklyTimeGridProps = {
  projects?: TimeGridProject[];
  locked?: boolean;
  showTimer?: boolean;
  className?: string;
};
