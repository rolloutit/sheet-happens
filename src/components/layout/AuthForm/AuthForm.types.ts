import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type AuthButtonVariant = "hero" | "outline" | "ghost";

export type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  loading?: boolean;
  trailing?: ReactNode;
  variant: AuthButtonVariant;
};

export type AuthFieldProps = {
  children: ReactNode;
  htmlFor: string;
  label: string;
  right?: ReactNode;
};

export type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: LucideIcon;
  trailing?: ReactNode;
};

export type AuthPasswordInputProps = Omit<AuthInputProps, "icon" | "type" | "trailing"> & {
  labels: {
    hide: string;
    show: string;
  };
};

export type AuthNoticeTone = "success" | "error" | "info" | "warning";

export type AuthNoticeProps = {
  children: ReactNode;
  className?: string;
  tone: AuthNoticeTone;
};

export type AuthScreenHeadProps = {
  description?: string;
  eyebrow?: string;
  title: string;
};
