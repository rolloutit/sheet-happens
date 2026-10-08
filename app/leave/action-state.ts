export type LeaveFormField = "type" | "startDate" | "endDate" | "dayPart" | "note" | "file";

export type LeaveActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<LeaveFormField, string>>;
};

export const initialLeaveActionState: LeaveActionState = {
  status: "idle",
  message: "",
};
