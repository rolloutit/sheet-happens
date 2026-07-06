export type VerifySecondFactorActionInput = {
  method: "totp" | "backup_code";
  code: string;
  trustDevice?: boolean;
};

export type VerifySecondFactorActionState =
  | {
      status: "success";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };
