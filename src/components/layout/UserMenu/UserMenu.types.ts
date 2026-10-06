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

/**
 * Copy for the confirmation step an action can require before it fires. Every string is
 * user-facing, so callers inside the app pass translated ones; the component's own defaults
 * exist for stories.
 */
export type UserMenuActionConfirm = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Accessible name of the dialog's close affordance — distinct from `cancelLabel` on purpose. */
  closeLabel: string;
};

export type UserMenuAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: UserMenuActionTone;
  disabled?: boolean;
  /**
   * Draws a divider and extra spacing above the item. A destructive action sitting flush against
   * the navigational ones is a mis-click waiting to happen, so it gets its own group.
   */
  separated?: boolean;
  /** When set, selecting the action opens this dialog instead of firing `onAction` straight away. */
  confirm?: UserMenuActionConfirm;
};

export type UserMenuProps = {
  user: UserMenuUser;
  actions?: UserMenuAction[];
  label?: string;
  align?: DropdownContentProps["align"];
  className?: string;
  onAction?: (actionId: string) => void;
};
