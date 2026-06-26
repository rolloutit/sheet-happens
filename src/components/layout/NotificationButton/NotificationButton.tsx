"use client";

import { Bell, CheckCheck } from "lucide-react";

import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/src/components/ui/Dropdown";
import { IconButton } from "@/src/components/ui/IconButton";
import { cn } from "@/src/lib/utils";
import type { NotificationButtonProps, NotificationTone } from "./NotificationButton.types";

const toneClasses: Record<NotificationTone, string> = {
  info: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-destructive",
};

export function NotificationButton({
  notifications = [],
  unreadCount,
  labels,
  align = "end",
  className,
  onNotificationSelect,
  onMarkAllRead,
  onViewAll,
}: NotificationButtonProps) {
  const count = unreadCount ?? notifications.filter((notification) => !notification.read).length;

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton
          icon={Bell}
          label={labels?.trigger ?? "Notifications"}
          dot={count > 0}
          className={className}
        />
      </DropdownTrigger>
      <DropdownContent align={align} className="w-80">
        <div className="flex items-center justify-between gap-3">
          <DropdownLabel>{labels?.menu ?? "Notifications"}</DropdownLabel>
          {count > 0 ? (
            <button
              type="button"
              className="mr-1 inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 font-ui text-xs font-semibold text-accent transition hover:bg-secondary"
              onClick={onMarkAllRead}
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              {labels?.markAllRead ?? "Mark read"}
            </button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
            {labels?.empty ?? "No notifications"}
          </div>
        ) : (
          <div className="grid gap-1">
            {notifications.map((notification) => (
              <DropdownItem
                key={notification.id}
                className="items-start gap-3 py-3"
                onSelect={() => onNotificationSelect?.(notification.id)}
              >
                <span
                  className={cn(
                    "mt-1 size-2 shrink-0 rounded-full",
                    notification.read ? "bg-muted" : toneClasses[notification.tone ?? "info"],
                  )}
                  aria-hidden="true"
                />
                <span className="grid min-w-0 gap-1">
                  <span className="truncate font-medium text-foreground">{notification.title}</span>
                  {notification.body ? (
                    <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {notification.body}
                    </span>
                  ) : null}
                  {notification.time ? (
                    <span className="font-ui text-[10px] font-semibold uppercase text-muted-foreground">
                      {notification.time}
                    </span>
                  ) : null}
                </span>
              </DropdownItem>
            ))}
          </div>
        )}
        {onViewAll ? (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={onViewAll}>{labels?.viewAll ?? "View all"}</DropdownItem>
          </>
        ) : null}
      </DropdownContent>
    </Dropdown>
  );
}
