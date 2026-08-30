import type { ReactNode } from "react";

import type { ShellNotification } from "../NotificationButton";
import type { RunningTimerSnapshot, RunningTimerStopResult } from "../RunningTimerProvider";
import type { UserMenuAction, UserMenuUser } from "../UserMenu";

export type AppShellProps = {
  children: ReactNode;
  current?: string;
  role?: "employee" | "contractor" | "admin";
  profile?: "employee" | "contractor";
  /** Initial collapsed state of the desktop sidebar; the toggle button owns it after mount. */
  collapsed?: boolean;
  mobileNavigationMode?: "auto" | "always";
  language?: string;
  user?: UserMenuUser;
  userActions?: UserMenuAction[];
  notifications?: ShellNotification[];
  /** Overrides the running timer from `RunningTimerProvider`; `null` forces "nothing running". */
  timer?: AppShellTimer | null;
  /** Overrides the provider's stop handler. Pass both, or neither. */
  onStopTimer?: () => Promise<AppShellTimerActionResult>;
  onNavigate?: (itemId: string) => void;
  onCommand?: () => void;
  onLanguageChange?: (language: string) => void;
  onNotificationSelect?: (notificationId: string) => void;
  onMarkAllRead?: () => void;
  onViewNotifications?: () => void;
  onUserAction?: (actionId: string) => void;
};

/*
  The shell no longer owns the running-timer shape; `RunningTimerProvider` does, because the root
  layout is where the value comes from. These aliases keep the prop names the shell has always
  exposed, which is what stories and tests drive the pill through.
*/
export type AppShellTimer = RunningTimerSnapshot;
export type AppShellTimerActionResult = RunningTimerStopResult;
