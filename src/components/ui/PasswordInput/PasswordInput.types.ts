import type { InputHTMLAttributes } from "react";

export type PasswordInputLabels = {
  show?: string;
  hide?: string;
};

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  invalid?: boolean;
  visible?: boolean;
  defaultVisible?: boolean;
  labels?: PasswordInputLabels;
  onVisibilityChange?: (visible: boolean) => void;
};
