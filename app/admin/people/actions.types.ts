export type InviteMemberField =
  | "email"
  | "firstName"
  | "lastName"
  | "profile"
  | "role"
  | "defaultCurrencyCode"
  | "timezone"
  | "locale";

export type UpdateMemberDetailsField =
  "firstName" | "lastName" | "displayName" | "defaultCurrencyCode" | "timezone" | "locale";

export type ScheduleProfileTransitionField = "profile" | "validFrom" | "reason";

export type UpdateMemberDetailsActionInput = {
  memberId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  defaultCurrencyCode: string;
  timezone: string;
  locale: string;
};

export type ScheduleProfileTransitionActionInput = {
  memberId: string;
  profile: "EMPLOYEE" | "CONTRACTOR";
  validFrom: string;
  reason: string;
};

export type InviteMemberActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<InviteMemberField, string>>;
};

export type UpdateMemberDetailsActionState = {
  status: "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<UpdateMemberDetailsField, string>>;
};

export type ScheduleProfileTransitionActionState = {
  status: "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<ScheduleProfileTransitionField, string>>;
};

export type AdminPeopleActionState = {
  status: "success" | "error";
  message: string;
};
