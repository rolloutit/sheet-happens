import type { AvatarTone } from "@/src/components/ui/Avatar";
import type { ButtonProps } from "@/src/components/ui/Button";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ProfileSettingsField = {
  id: string;
  label: string;
  value: string;
  readOnly?: boolean;
};

export type ProfileSettingsAction = {
  label: ReactNode;
  icon?: LucideIcon;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  onClick?: () => void;
};

export type ProfileSettingsPanelProps = {
  title?: string;
  description?: ReactNode;
  badge?: ReactNode;
  name: string;
  subtitle?: ReactNode;
  avatarTone?: AvatarTone;
  fields: ProfileSettingsField[];
  action?: ProfileSettingsAction;
  className?: string;
};
