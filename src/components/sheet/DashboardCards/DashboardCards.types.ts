import type { ButtonProps } from "@/src/components/ui/Button";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { FlaggedUserItem } from "../FlaggedUserList";
import type { StatCardProps } from "../StatCard";
import type { StatusOverviewSegment } from "../StatusOverview";

export type DashboardRole = "employee" | "contractor" | "admin";

export type DashboardHeroAction = {
  label: ReactNode;
  icon?: LucideIcon;
  variant?: ButtonProps["variant"];
  onClick?: () => void;
};

export type DashboardChecklistItem = {
  id: string;
  label: ReactNode;
  checked?: boolean;
  disabled?: boolean;
};

export type DashboardCardsProps = {
  name?: string;
  role?: DashboardRole;
  roleLabel?: ReactNode;
  greeting?: ReactNode;
  summary?: ReactNode;
  primaryAction?: DashboardHeroAction;
  secondaryAction?: DashboardHeroAction;
  stats?: StatCardProps[];
  checklistTitle?: ReactNode;
  checklistDescription?: ReactNode;
  checklistBadge?: ReactNode;
  checklistItems?: DashboardChecklistItem[];
  flaggedUsers?: FlaggedUserItem[];
  selectedFlaggedUserIds?: string[];
  onFlaggedUserSelectionChange?: (ids: string[]) => void;
  onRemindFlaggedUsers?: (ids: string[]) => void;
  reminderSent?: boolean;
  statusTitle?: ReactNode;
  statusSegments?: StatusOverviewSegment[];
  statusAction?: ReactNode;
  className?: string;
};
