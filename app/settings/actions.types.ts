export type SecuritySettingsActionState = {
  status: "success" | "error";
  message: string;
};

export type MemberPreferenceActionState =
  | {
      status: "idle";
      message: "";
    }
  | {
      status: "success" | "error";
      message: string;
    };

export type NotificationSettingsActionState = MemberPreferenceActionState;

export type RenamePasskeyActionInput = {
  passkeyId: string;
  name: string;
};

export type DeletePasskeyActionInput = {
  passkeyId: string;
};

export type DisconnectConnectedAppActionInput = {
  /** The OAuth `client_id` of the connected app: a CIMD URL, or an opaque registered id. */
  clientId: string;
};
