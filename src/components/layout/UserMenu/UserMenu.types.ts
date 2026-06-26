import type { LucideIcon } from "lucide-react";

import type { DropdownContentProps } from "@/src/components/ui/Dropdown";

export type UserMenuUser = {
  name: string;
  email?: string;
  role?: string;
  initials?: string;
  avatarSrc?: string;
};

export type UserMenuActionTone = "default" | "danger";

export type UserMenuAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: UserMenuActionTone;
  disabled?: boolean;
};

export type UserMenuProps = {
  user: UserMenuUser;
  actions?: UserMenuAction[];
  label?: string;
  align?: DropdownContentProps["align"];
  className?: string;
  onAction?: (actionId: string) => void;
};
