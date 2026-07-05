export type SecuritySettingsActionState = {
  status: "success" | "error";
  message: string;
};

export type RenamePasskeyActionInput = {
  passkeyId: string;
  name: string;
};

export type DeletePasskeyActionInput = {
  passkeyId: string;
};
