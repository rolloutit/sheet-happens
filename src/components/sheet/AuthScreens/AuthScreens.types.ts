export type AuthScreenMode =
  | "sign-in"
  | "two-factor"
  | "invite"
  | "password-setup"
  | "passkey"
  | "reset-sent"
  | "done";

export type AuthScreensProps = {
  mode?: AuthScreenMode;
  email?: string;
  className?: string;
};
