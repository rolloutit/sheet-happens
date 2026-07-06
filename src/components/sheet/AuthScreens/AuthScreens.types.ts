export type AuthScreenMode =
  "sign-in" | "two-factor" | "invite" | "password-setup" | "passkey" | "reset-sent" | "done";

export type AuthVerificationMode = "totp" | "backup_code";

export type AuthSignInPayload = {
  email: string;
  password: string;
};

export type AuthPasswordSetupPayload = {
  password: string;
};

export type AuthScreensProps = {
  mode?: AuthScreenMode;
  email?: string;
  className?: string;
  onSignIn?: (payload: AuthSignInPayload) => void;
  onMagicLink?: (email: string) => void;
  onResetPassword?: (email: string) => void;
  onVerifyCode?: (code: string, mode: AuthVerificationMode) => void;
  onVerificationModeChange?: (mode: AuthVerificationMode) => void;
  onInvitePasswordSetup?: () => void;
  onInviteGoogle?: () => void;
  onPasswordSave?: (payload: AuthPasswordSetupPayload) => void;
  onPasskeySetup?: () => void;
  onPasskeySkip?: () => void;
  onBackToSignIn?: () => void;
  onContinue?: () => void;
};
