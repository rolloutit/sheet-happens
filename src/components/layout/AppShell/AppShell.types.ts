import type { ReactNode } from "react";

import type { ShellNotification } from "../NotificationButton";
import type { UserMenuAction, UserMenuUser } from "../UserMenu";

export type AppShellProps = {
  children: ReactNode;
  current?: string;
  role?: "employee" | "contractor" | "admin";
  collapsed?: boolean;
  mobileNavigationMode?: "auto" | "always";
  language?: string;
  user?: UserMenuUser;
  userActions?: UserMenuAction[];
  notifications?: ShellNotification[];
  onNavigate?: (itemId: string) => void;
  onCommand?: () => void;
  onLanguageChange?: (language: string) => void;
  onNotificationSelect?: (notificationId: string) => void;
  onMarkAllRead?: () => void;
  onViewNotifications?: () => void;
  onUserAction?: (actionId: string) => void;
};
