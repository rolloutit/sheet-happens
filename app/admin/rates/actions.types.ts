export type RateFormField = "validFrom" | "validTo" | "hourlyRate" | "currencyCode" | "note";

export type RateActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<RateFormField, string>>;
};

export type CreateMemberDefaultRateActionInput = {
  memberId: string;
  validFrom: string;
  validTo: string;
  hourlyRate: string;
  currencyCode: string;
  note: string;
};

export type CreateAssignmentOverrideRateActionInput = {
  projectAssignmentId: string;
  validFrom: string;
  validTo: string;
  hourlyRate: string;
  currencyCode: string;
  note: string;
};
