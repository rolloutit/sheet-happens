import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type NotificationPreferenceItem = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  enabled: boolean;
  icon?: LucideIcon;
  disabled?: boolean;
};

export type NotificationCadenceOption = {
  value: string;
  label: ReactNode;
};

export type NotificationPreferencesProps = {
  title?: string;
  description?: ReactNode;
  items: NotificationPreferenceItem[];
  cadenceValue?: string;
  cadenceOptions?: NotificationCadenceOption[];
  onPreferenceChange?: (id: string, enabled: boolean) => void;
  onCadenceChange?: (value: string) => void;
  onReset?: () => void;
  resetLabel?: ReactNode;
  className?: string;
};
