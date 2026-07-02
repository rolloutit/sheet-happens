export type InviteMemberField =
  | "email"
  | "firstName"
  | "lastName"
  | "profile"
  | "role"
  | "defaultCurrencyCode"
  | "timezone"
  | "locale";

export type InviteMemberActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<InviteMemberField, string>>;
};
