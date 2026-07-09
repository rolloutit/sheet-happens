export type TimeTrackingActionStatus = "idle" | "success" | "error";

export type TimeTrackingActionState = {
  status: TimeTrackingActionStatus;
  message: string;
  fieldErrors?: Partial<Record<TimeEntryFormField, string>>;
};

export type TimeEntryFormField =
  "projectId" | "localDate" | "durationMinutes" | "description" | "startTime" | "endTime";

export type TimeEntryTimingMode = "DURATION" | "INTERVAL";

export type CreateTimeEntryActionInput = {
  projectId: string;
  localDate: string;
  timingMode?: TimeEntryTimingMode;
  durationMinutes?: number;
  startTime?: string | null;
  endTime?: string | null;
  description: string;
  source?: "GRID" | "FORM";
};

export type UpdateTimeEntryActionInput = {
  timeEntryId: string;
  projectId?: string;
  localDate?: string;
  timingMode?: TimeEntryTimingMode;
  durationMinutes?: number;
  startTime?: string | null;
  endTime?: string | null;
  description?: string;
};

export type DeleteTimeEntryActionInput = {
  timeEntryId: string;
};

export type InactiveProjectWeekActionInput = {
  projectId: string;
  weekStartDate: string;
  note?: string;
};

export type StartRunningTimerActionInput = {
  projectId: string;
  description: string;
};
