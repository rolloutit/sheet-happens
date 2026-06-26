import type { AvatarTone } from "@/src/components/ui/Avatar";
import type { BadgeProps } from "@/src/components/ui/Badge";
import type { ReactNode } from "react";

export type FlaggedUserSeverity = "info" | "warning" | "danger";

export type FlaggedUserItem = {
  id: string;
  name: string;
  detail: ReactNode;
  severity?: FlaggedUserSeverity;
  avatarTone?: AvatarTone;
  disabled?: boolean;
};

export type FlaggedUserListLabels = {
  selectAll?: string;
  remind?: string;
  sent?: ReactNode;
  empty?: ReactNode;
  selected?: (count: number) => ReactNode;
};

export type FlaggedUserListProps = {
  title?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  badgeTone?: BadgeProps["tone"];
  items: FlaggedUserItem[];
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onRemind?: (ids: string[]) => void;
  reminderSent?: boolean;
  labels?: FlaggedUserListLabels;
  className?: string;
};
