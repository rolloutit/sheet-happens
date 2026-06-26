import type { DropdownContentProps } from "@/src/components/ui/Dropdown";

export type NotificationTone = "info" | "success" | "warning" | "error";

export type ShellNotification = {
  id: string;
  title: string;
  body?: string;
  time?: string;
  tone?: NotificationTone;
  read?: boolean;
};

export type NotificationButtonLabels = {
  trigger?: string;
  menu?: string;
  empty?: string;
  markAllRead?: string;
  viewAll?: string;
};

export type NotificationButtonProps = {
  notifications?: ShellNotification[];
  unreadCount?: number;
  labels?: NotificationButtonLabels;
  align?: DropdownContentProps["align"];
  className?: string;
  onNotificationSelect?: (notificationId: string) => void;
  onMarkAllRead?: () => void;
  onViewAll?: () => void;
};
