export type ActivateInvitationActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};
