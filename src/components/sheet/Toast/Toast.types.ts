export type ToastKind = "success" | "error" | "info" | "warning";

export type ToastCommand = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  description?: string;
  action?: ToastCommand;
  cancel?: ToastCommand;
  duration?: number;
};
