"use client";

import { Bell, CheckCheck } from "lucide-react";
import type { Route } from "next";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  notifications,
  unreadCount,
  labels,
  align = "end",
  className,
  onNotificationSelect,
  onMarkAllRead,
  onViewAll,
}: NotificationButtonProps) {
  const locale = useLocale();
  const router = useRouter();
  const [loadedNotifications, setLoadedNotifications] = useState<
    NonNullable<NotificationButtonProps["notifications"]>
  >([]);
  const [loadedUnreadCount, setLoadedUnreadCount] = useState(0);
  const resolvedNotifications = notifications ?? loadedNotifications;
  const count =
    unreadCount ??
    (notifications
      ? notifications.filter((notification) => !notification.read).length
      : loadedUnreadCount);

  useEffect(() => {
    if (notifications) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadNotifications = async () => {
      try {
        const response = await fetch(`/api/notifications?locale=${encodeURIComponent(locale)}`, {
          cache: "no-store",
        });
        const data = response.ok
          ? ((await response.json()) as {
              notifications?: NonNullable<NotificationButtonProps["notifications"]>;
              unreadCount?: number;
            })
          : null;
        if (!active || !data) return;
        setLoadedNotifications(data.notifications ?? []);
        setLoadedUnreadCount(data.unreadCount ?? 0);
      } catch {
        // A later poll retries transient network or session failures.
      } finally {
        if (active) timer = setTimeout(() => void loadNotifications(), 15_000);
      }
    };

    void loadNotifications();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [locale, notifications]);

  async function selectNotification(notification: (typeof resolvedNotifications)[number]) {
    if (!notification.read) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notification.id }),
      }).catch(() => undefined);
      setLoadedNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      );
      setLoadedUnreadCount((current) => Math.max(0, current - 1));
    }
    onNotificationSelect?.(notification.id);
    if (!onNotificationSelect && notification.actionUrl)
      router.push(notification.actionUrl as Route);
  }

  async function markAllRead() {
    if (onMarkAllRead) return onMarkAllRead();
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined);
    setLoadedNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setLoadedUnreadCount(0);
  }

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
      <DropdownContent
        align={align}
        collisionPadding={8}
        className="w-[min(20rem,calc(100vw-1rem))]"
      >
        <div className="flex items-center justify-between gap-3">
          <DropdownLabel>{labels?.menu ?? "Notifications"}</DropdownLabel>
          {count > 0 ? (
            <button
              type="button"
              className="mr-1 inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 font-ui text-xs font-semibold text-accent transition hover:bg-secondary"
              onClick={markAllRead}
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              {labels?.markAllRead ?? "Mark read"}
            </button>
          ) : null}
        </div>
        {resolvedNotifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
            {labels?.empty ?? "No notifications"}
          </div>
        ) : (
          <div className="grid gap-1">
            {resolvedNotifications.map((notification) => (
              <DropdownItem
                key={notification.id}
                className="items-start gap-3 py-3"
                onSelect={() => void selectNotification(notification)}
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
                  {notification.time || notification.createdAt ? (
                    <span className="font-ui text-[10px] font-semibold uppercase text-muted-foreground">
                      {notification.time ?? formatRelativeTime(notification.createdAt, locale)}
                    </span>
                  ) : null}
                </span>
              </DropdownItem>
            ))}
          </div>
        )}
        {onViewAll || !notifications ? (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={onViewAll ?? (() => router.push("/notifications" as Route))}>
              {labels?.viewAll ?? "View all"}
            </DropdownItem>
          </>
        ) : null}
      </DropdownContent>
    </Dropdown>
  );
}

function formatRelativeTime(value: string | undefined, locale: string) {
  if (!value) return "";
  const diffMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");
  const hours = Math.round(diffMinutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}
