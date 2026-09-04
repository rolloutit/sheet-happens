export type CorrectDeclaredHoursField = "minutes" | "note" | "reason";

export type CorrectDeclaredHoursActionInput = {
  memberId: string;
  projectId: string;
  /** The first of the month, `YYYY-MM-01`. */
  periodStart: string;
  minutes: number;
  note: string;
  /**
   * Why the admin is overriding the member's own figure. Required, and stored on both records as
   * `adminModificationReason` — it is what the member reads in their notification.
   */
  reason: string;
};

export type CorrectDeclaredHoursActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<CorrectDeclaredHoursField, string>>;
};
