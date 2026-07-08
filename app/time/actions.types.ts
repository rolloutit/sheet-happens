export type TimeTrackingActionStatus = "idle" | "success" | "error";

export type TimeTrackingActionState = {
  status: TimeTrackingActionStatus;
  message: string;
  fieldErrors?: Partial<Record<TimeEntryFormField, string>>;
};

export type TimeEntryFormField = "projectId" | "localDate" | "durationMinutes" | "description";

export type CreateTimeEntryActionInput = {
  projectId: string;
  localDate: string;
  durationMinutes: number;
  description: string;
  source?: "GRID" | "FORM";
};

export type UpdateTimeEntryActionInput = {
  timeEntryId: string;
  projectId?: string;
  localDate?: string;
  durationMinutes?: number;
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
