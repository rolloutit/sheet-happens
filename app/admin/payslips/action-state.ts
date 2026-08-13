export type AdminPayslipActionState = {
  status: "idle" | "success" | "error";
  message: string;
  replaced?: boolean;
};

export const initialAdminPayslipActionState: AdminPayslipActionState = {
  status: "idle",
  message: "",
};
